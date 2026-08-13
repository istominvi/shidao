"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  component: Pick<LessonComponent, "typeKey" | "payload" | "placement">;
  assets: CourseAsset[];
  disabled?: boolean;
  saveError?: string | null;
  cancelLabel?: string;
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

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function newStableId() {
  return globalThis.crypto.randomUUID();
}

function withOptionalString(
  payload: Record<string, unknown>,
  key: string,
  value: string,
) {
  const next = { ...payload };
  if (value.trim()) next[key] = value;
  else delete next[key];
  return next;
}

function integerValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function splitPair(line: string) {
  const separatorIndex = line.indexOf("=");
  return {
    left: (separatorIndex < 0 ? line : line.slice(0, separatorIndex)).trim(),
    right: (separatorIndex < 0 ? "" : line.slice(separatorIndex + 1)).trim(),
  };
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
    <label className="component-editor-field">
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
  return "field-input component-editor-select bg-white";
}

function textareaClassName() {
  return "field-input component-editor-textarea resize-y";
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
        <div className="grid gap-4">
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
          <Field label="Текст">
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
        </div>
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
    case "video":
      return (
        <div className="grid gap-4">
          <Field
            label="HTTPS-ссылка на видео"
            hint="Ссылка должна начинаться с https://."
          >
            <input
              type="url"
              className="field-input"
              value={stringValue(payload.url)}
              onChange={(event) =>
                onChange({ ...payload, url: event.target.value })
              }
            />
          </Field>
          <Field label="Название (необязательно)">
            <input
              className="field-input"
              value={stringValue(payload.title)}
              onChange={(event) =>
                onChange(
                  withOptionalString(payload, "title", event.target.value),
                )
              }
            />
          </Field>
          <Field label="Подпись (необязательно)">
            <input
              className="field-input"
              value={stringValue(payload.caption)}
              onChange={(event) =>
                onChange(
                  withOptionalString(payload, "caption", event.target.value),
                )
              }
            />
          </Field>
          <Field
            label="HTTPS-ссылка на субтитры (необязательно)"
            hint="Например, файл WebVTT с расширением .vtt."
          >
            <input
              type="url"
              className="field-input"
              value={stringValue(payload.captionsUrl)}
              onChange={(event) =>
                onChange(
                  withOptionalString(
                    payload,
                    "captionsUrl",
                    event.target.value,
                  ),
                )
              }
            />
          </Field>
        </div>
      );
    case "audio":
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название">
              <input
                className="field-input"
                value={stringValue(payload.title)}
                onChange={(event) =>
                  onChange({ ...payload, title: event.target.value })
                }
              />
            </Field>
            <Field
              label="HTTPS-ссылка на аудио"
              hint="Ссылка должна начинаться с https://."
            >
              <input
                type="url"
                className="field-input"
                value={stringValue(payload.url)}
                onChange={(event) =>
                  onChange({ ...payload, url: event.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Транскрипт (необязательно)">
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.transcript)}
              onChange={(event) =>
                onChange(
                  withOptionalString(payload, "transcript", event.target.value),
                )
              }
            />
          </Field>
          <label className="flex items-center gap-2 component-editor-checkbox">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.showTranscriptByDefault)}
              onChange={(event) =>
                onChange({
                  ...payload,
                  showTranscriptByDefault: event.target.checked,
                })
              }
            />
            Показывать транскрипт сразу
          </label>
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
          <label className="flex items-center gap-2 component-editor-checkbox">
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
          <label className="flex items-center gap-2 component-editor-checkbox">
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
          <label className="flex items-center gap-2 component-editor-checkbox">
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
    case "choice_quiz": {
      const options = objectArray(payload.options);
      const optionLines = options.map(
        (option) =>
          `${booleanValue(option.isCorrect) ? "+" : "-"} ${stringValue(option.label)}`,
      );
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
            hint="Один вариант на строку: «+ правильный» или «- неправильный». От 2 до 20 вариантов."
          >
            <textarea
              className={textareaClassName()}
              value={optionLines.join("\n")}
              onChange={(event) => {
                const nextOptions = event.target.value
                  .split("\n")
                  .map((line, index) => {
                    const marked = line.match(/^\s*([+-])\s?(.*)$/);
                    return {
                      id: stringValue(options[index]?.id) || newStableId(),
                      label: (marked?.[2] ?? line).trim(),
                      isCorrect: marked
                        ? marked[1] === "+"
                        : booleanValue(options[index]?.isCorrect),
                    };
                  });
                onChange({ ...payload, options: nextOptions });
              }}
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 component-editor-checkbox">
              <input
                type="checkbox"
                className="auth-checkbox"
                checked={booleanValue(payload.allowMultiple)}
                onChange={(event) => {
                  const allowMultiple = event.target.checked;
                  const nextOptions = allowMultiple
                    ? options
                    : options.map((option, index) => ({
                        ...option,
                        isCorrect:
                          index ===
                          options.findIndex((item) =>
                            booleanValue(item.isCorrect),
                          ),
                      }));
                  onChange({
                    ...payload,
                    options: nextOptions,
                    allowMultiple,
                  });
                }}
              />
              Разрешить несколько ответов
            </label>
            <label className="flex items-center gap-2 component-editor-checkbox">
              <input
                type="checkbox"
                className="auth-checkbox"
                checked={booleanValue(payload.shuffle, true)}
                onChange={(event) =>
                  onChange({ ...payload, shuffle: event.target.checked })
                }
              />
              Перемешивать варианты
            </label>
          </div>
          <Field label="Пояснение после ответа (необязательно)">
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.explanation)}
              onChange={(event) =>
                onChange(
                  withOptionalString(
                    payload,
                    "explanation",
                    event.target.value,
                  ),
                )
              }
            />
          </Field>
        </div>
      );
    }
    case "fill_blanks": {
      const answers = objectArray(payload.answers);
      const answerLines = answers.map((answer) => {
        const accepted = stringArray(answer.accepted).join("|");
        const hint = stringValue(answer.hint);
        return hint ? `${accepted} :: ${hint}` : accepted;
      });
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
            label="Текст с пропусками"
            hint="Обозначайте пропуски подряд: [[1]], [[2]], [[3]] и так далее."
          >
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.template)}
              onChange={(event) =>
                onChange({ ...payload, template: event.target.value })
              }
            />
          </Field>
          <Field
            label="Ответы"
            hint="Одна строка на пропуск. Допустимые варианты разделяйте |, подсказку добавляйте после ::."
          >
            <textarea
              className={textareaClassName()}
              value={answerLines.join("\n")}
              onChange={(event) => {
                const nextAnswers = event.target.value
                  .split("\n")
                  .map((line) => {
                    const [acceptedPart, ...hintParts] = line.split("::");
                    const hint = hintParts.join("::").trim();
                    return {
                      accepted: acceptedPart
                        .split("|")
                        .map((alternative) => alternative.trim()),
                      ...(hint ? { hint } : {}),
                    };
                  });
                onChange({ ...payload, answers: nextAnswers });
              }}
            />
          </Field>
        </div>
      );
    }
    case "word_bank":
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
            label="Текст с пропусками"
            hint="Обозначайте пропуски подряд: [[1]], [[2]], [[3]] и так далее."
          >
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.template)}
              onChange={(event) =>
                onChange({ ...payload, template: event.target.value })
              }
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Ответы"
              hint="Один ответ на строку. Допустимые варианты разделяйте |."
            >
              <textarea
                className={textareaClassName()}
                value={stringArray(payload.answers).join("\n")}
                onChange={(event) =>
                  onChange({
                    ...payload,
                    answers: event.target.value.split("\n"),
                  })
                }
              />
            </Field>
            <Field
              label="Лишние слова"
              hint="Одно слово или выражение на строку. Можно оставить пустым."
            >
              <textarea
                className={textareaClassName()}
                value={stringArray(payload.distractors).join("\n")}
                onChange={(event) =>
                  onChange({
                    ...payload,
                    distractors: event.target.value.trim()
                      ? event.target.value.split("\n")
                      : [],
                  })
                }
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 component-editor-checkbox">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.shuffle, true)}
              onChange={(event) =>
                onChange({ ...payload, shuffle: event.target.checked })
              }
            />
            Перемешивать банк слов
          </label>
        </div>
      );
    case "sequence": {
      const items = objectArray(payload.items);
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
            <Field label="Инструкция">
              <input
                className="field-input"
                value={stringValue(payload.instruction)}
                onChange={(event) =>
                  onChange({ ...payload, instruction: event.target.value })
                }
              />
            </Field>
            <Field label="Режим">
              <select
                className={selectClassName()}
                value={stringValue(payload.mode) || "sentences"}
                onChange={(event) =>
                  onChange({ ...payload, mode: event.target.value })
                }
              >
                <option value="words">Слова</option>
                <option value="sentences">Предложения</option>
              </select>
            </Field>
          </div>
          <Field
            label="Правильный порядок"
            hint="Один элемент на строку, от 2 до 40. Порядок строк считается правильным."
          >
            <textarea
              className={textareaClassName()}
              value={items.map((item) => stringValue(item.text)).join("\n")}
              onChange={(event) =>
                onChange({
                  ...payload,
                  items: event.target.value.split("\n").map((text, index) => ({
                    id: stringValue(items[index]?.id) || newStableId(),
                    text,
                  })),
                })
              }
            />
          </Field>
          <label className="flex items-center gap-2 component-editor-checkbox">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.shuffle, true)}
              onChange={(event) =>
                onChange({ ...payload, shuffle: event.target.checked })
              }
            />
            Перемешивать перед показом
          </label>
        </div>
      );
    }
    case "categorize": {
      const categories = objectArray(payload.categories);
      const items = objectArray(payload.items);
      const categoryLabelById = new Map(
        categories.map((category) => [
          stringValue(category.id),
          stringValue(category.label),
        ]),
      );
      const itemLines = items.map((item) => {
        const categoryId = stringValue(item.categoryId);
        const categoryLabel = categoryId.startsWith("draft:")
          ? categoryId.slice("draft:".length)
          : (categoryLabelById.get(categoryId) ?? "");
        return `${stringValue(item.text)} = ${categoryLabel}`;
      });
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
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Категории"
              hint="Одна категория на строку, от 2 до 12."
            >
              <textarea
                className={textareaClassName()}
                value={categories
                  .map((category) => stringValue(category.label))
                  .join("\n")}
                onChange={(event) =>
                  onChange({
                    ...payload,
                    categories: event.target.value
                      .split("\n")
                      .map((label, index) => ({
                        id: stringValue(categories[index]?.id) || newStableId(),
                        label,
                      })),
                  })
                }
              />
            </Field>
            <Field
              label="Элементы"
              hint="Один элемент на строку: «элемент = точное название категории»."
            >
              <textarea
                className={textareaClassName()}
                value={itemLines.join("\n")}
                onChange={(event) => {
                  const nextItems = event.target.value
                    .split("\n")
                    .map((line, index) => {
                      const { left, right } = splitPair(line);
                      const category = categories.find(
                        (item) =>
                          stringValue(item.label).toLocaleLowerCase("ru-RU") ===
                          right.toLocaleLowerCase("ru-RU"),
                      );
                      return {
                        id: stringValue(items[index]?.id) || newStableId(),
                        text: left,
                        categoryId: category
                          ? stringValue(category.id)
                          : `draft:${right}`,
                      };
                    });
                  onChange({ ...payload, items: nextItems });
                }}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 component-editor-checkbox">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.shuffle, true)}
              onChange={(event) =>
                onChange({ ...payload, shuffle: event.target.checked })
              }
            />
            Перемешивать элементы
          </label>
        </div>
      );
    }
    case "free_response":
      return (
        <div className="grid gap-4">
          <Field label="Задание">
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.prompt)}
              onChange={(event) =>
                onChange({ ...payload, prompt: event.target.value })
              }
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Поле ответа">
              <select
                className={selectClassName()}
                value={stringValue(payload.responseType) || "long"}
                onChange={(event) =>
                  onChange({ ...payload, responseType: event.target.value })
                }
              >
                <option value="short">Короткое</option>
                <option value="long">Развёрнутое</option>
              </select>
            </Field>
            <Field label="Минимум символов">
              <input
                type="number"
                min={0}
                max={20_000}
                className="field-input"
                value={String(payload.minChars ?? 0)}
                onChange={(event) =>
                  onChange({
                    ...payload,
                    minChars: integerValue(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="Максимум символов">
              <input
                type="number"
                min={1}
                max={20_000}
                className="field-input"
                value={String(payload.maxChars ?? 2_000)}
                onChange={(event) =>
                  onChange({
                    ...payload,
                    maxChars: integerValue(event.target.value),
                  })
                }
              />
            </Field>
          </div>
          <Field label="Подсказка внутри поля (необязательно)">
            <input
              className="field-input"
              value={stringValue(payload.placeholder)}
              onChange={(event) =>
                onChange(
                  withOptionalString(
                    payload,
                    "placeholder",
                    event.target.value,
                  ),
                )
              }
            />
          </Field>
        </div>
      );
    case "external_link":
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Название ссылки">
              <input
                className="field-input"
                value={stringValue(payload.label)}
                onChange={(event) =>
                  onChange({ ...payload, label: event.target.value })
                }
              />
            </Field>
            <Field
              label="HTTPS-ссылка"
              hint="Ссылка должна начинаться с https://."
            >
              <input
                type="url"
                className="field-input"
                value={stringValue(payload.url)}
                onChange={(event) =>
                  onChange({ ...payload, url: event.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Описание (необязательно)">
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.description)}
              onChange={(event) =>
                onChange(
                  withOptionalString(
                    payload,
                    "description",
                    event.target.value,
                  ),
                )
              }
            />
          </Field>
          <label className="flex items-center gap-2 component-editor-checkbox">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.openInNewTab, true)}
              onChange={(event) =>
                onChange({
                  ...payload,
                  openInNewTab: event.target.checked,
                })
              }
            />
            Открывать в новой вкладке
          </label>
        </div>
      );
    case "word_builder":
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
          <Field label="Слово, которое нужно собрать">
            <input
              className="field-input"
              value={stringValue(payload.targetWord)}
              onChange={(event) =>
                onChange({ ...payload, targetWord: event.target.value })
              }
            />
          </Field>
          <Field label="Подсказка (необязательно)">
            <input
              className="field-input"
              value={stringValue(payload.hint)}
              onChange={(event) =>
                onChange(
                  withOptionalString(payload, "hint", event.target.value),
                )
              }
            />
          </Field>
          <label className="flex items-center gap-2 component-editor-checkbox">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.shuffle, true)}
              onChange={(event) =>
                onChange({ ...payload, shuffle: event.target.checked })
              }
            />
            Перемешивать буквы
          </label>
        </div>
      );
    case "vocabulary_list": {
      const items = objectArray(payload.items);
      const itemLines = items.map(
        (item) => `${stringValue(item.term)} = ${stringValue(item.definition)}`,
      );
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
            <Field label="Заголовок (необязательно)">
              <input
                className="field-input"
                value={stringValue(payload.title)}
                onChange={(event) =>
                  onChange(
                    withOptionalString(payload, "title", event.target.value),
                  )
                }
              />
            </Field>
            <Field label="Отображение">
              <select
                className={selectClassName()}
                value={stringValue(payload.display) || "list"}
                onChange={(event) =>
                  onChange({ ...payload, display: event.target.value })
                }
              >
                <option value="list">Список</option>
                <option value="cards">Карточки</option>
              </select>
            </Field>
          </div>
          <Field
            label="Термины и определения"
            hint="Одна пара на строку в формате «термин = определение», до 100 пар."
          >
            <textarea
              className={textareaClassName()}
              value={itemLines.join("\n")}
              onChange={(event) =>
                onChange({
                  ...payload,
                  items: event.target.value.split("\n").map((line, index) => {
                    const { left, right } = splitPair(line);
                    return {
                      id: stringValue(items[index]?.id) || newStableId(),
                      term: left,
                      definition: right,
                    };
                  }),
                })
              }
            />
          </Field>
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
      {typeKey === "image" || typeKey === "video" || typeKey === "slideshow" ? (
        <>
          <Field label="Выравнивание блока">
            <select
              className={selectClassName()}
              value={stringValue(placement.align) || "center"}
              onChange={(event) =>
                onChange({ ...placement, align: event.target.value })
              }
            >
              <option value="start">Слева</option>
              <option value="center">По центру</option>
              <option value="end">Справа</option>
              <option value="stretch">Растянуть</option>
            </select>
          </Field>
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
      {typeKey === "audio" ||
      typeKey === "single_choice_poll" ||
      typeKey === "matching_game" ||
      typeKey === "choice_quiz" ||
      typeKey === "fill_blanks" ||
      typeKey === "word_bank" ||
      typeKey === "sequence" ||
      typeKey === "categorize" ||
      typeKey === "free_response" ||
      typeKey === "word_builder" ||
      typeKey === "vocabulary_list" ? (
        <label className="flex items-center gap-2 self-end pb-3 component-editor-checkbox">
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
      {typeKey === "external_link" ? (
        <>
          <Field label="Выравнивание">
            <select
              className={selectClassName()}
              value={stringValue(placement.align) || "start"}
              onChange={(event) =>
                onChange({ ...placement, align: event.target.value })
              }
            >
              <option value="start">Слева</option>
              <option value="center">По центру</option>
              <option value="end">Справа</option>
              <option value="stretch">Растянуть</option>
            </select>
          </Field>
          <Field label="Вид ссылки">
            <select
              className={selectClassName()}
              value={stringValue(placement.style) || "card"}
              onChange={(event) =>
                onChange({ ...placement, style: event.target.value })
              }
            >
              <option value="card">Карточка</option>
              <option value="button">Кнопка</option>
              <option value="text">Текстовая ссылка</option>
            </select>
          </Field>
        </>
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
  saveError,
  cancelLabel = "Отмена",
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
  const editorRef = useRef<HTMLDivElement>(null);
  const definition = useMemo(
    () => getComponentDefinition(component.typeKey),
    [component.typeKey],
  );

  useEffect(() => {
    editorRef.current
      ?.querySelector<HTMLElement>("input, textarea, select, button")
      ?.focus();
  }, []);

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
    <div ref={editorRef} className="component-payload-editor">
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
      {saveError ? (
        <p className="text-sm font-medium text-rose-700" role="alert">
          {saveError}
        </p>
      ) : null}
      <div className="component-payload-editor-actions">
        <Button disabled={disabled} onClick={() => void save()}>
          Сохранить компонент
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}
