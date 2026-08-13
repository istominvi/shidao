"use client";

import { useState } from "react";
import { Bot, LoaderCircle, RefreshCw, WandSparkles } from "lucide-react";
import {
  applyAiLessonPlan,
  generateAiLessonPlan,
} from "@/components/course-builder/course-builder-client";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type { CourseBuilderMutationRunner } from "./lesson-authoring-workspace";
import type {
  AiLessonComponentPlan,
  AiLessonPlanPreview,
} from "@/modules/ai/course-builder-contracts";
import { getComponentDefinition } from "@/modules/course-builder/registry/contracts";

function compactPreview(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 110 ? normalized : `${normalized.slice(0, 109)}…`;
}

function componentPreview(component: AiLessonComponentPlan) {
  switch (component.typeKey) {
    case "rich_text":
      return [component.payload.title, component.payload.content]
        .filter(Boolean)
        .join(": ");
    case "callout":
      return [component.payload.title, component.payload.text]
        .filter(Boolean)
        .join(": ");
    case "single_choice_poll":
      return component.payload.question;
    case "matching_game":
      return component.payload.instruction;
  }
}

function AiComponentContent({
  component,
}: {
  component: AiLessonComponentPlan;
}) {
  switch (component.typeKey) {
    case "rich_text":
      return (
        <div className="grid gap-1">
          {component.payload.title ? (
            <strong>{component.payload.title}</strong>
          ) : null}
          {component.payload.content ? (
            <p className="whitespace-pre-wrap">{component.payload.content}</p>
          ) : null}
        </div>
      );
    case "callout":
      return (
        <div className="grid gap-1">
          {component.payload.title ? (
            <strong>{component.payload.title}</strong>
          ) : null}
          <p className="whitespace-pre-wrap">{component.payload.text}</p>
        </div>
      );
    case "single_choice_poll":
      return (
        <div className="grid gap-2">
          <strong>{component.payload.question}</strong>
          <ul className="list-disc space-y-1 pl-5">
            {component.payload.options.map((option) => (
              <li key={option.id}>{option.label}</li>
            ))}
          </ul>
        </div>
      );
    case "matching_game":
      return (
        <div className="grid gap-2">
          <strong>{component.payload.instruction}</strong>
          <ul className="space-y-1">
            {component.payload.pairs.map((pair) => (
              <li key={pair.id}>
                {pair.left} ↔ {pair.right}
              </li>
            ))}
          </ul>
        </div>
      );
  }
}

export function AiLessonPlanDialog({
  courseId,
  lessonId,
  title,
  disabled,
  runMutation,
  onClose,
  onApplied,
}: {
  courseId: string;
  lessonId: string | null;
  title: string;
  disabled: boolean;
  runMutation: CourseBuilderMutationRunner;
  onClose: () => void;
  onApplied: (lessonId: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [preview, setPreview] = useState<AiLessonPlanPreview | null>(null);
  const [planning, setPlanning] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function plan() {
    if (planning || disabled) return;
    setPlanning(true);
    setLocalError(null);
    try {
      setPreview(
        await generateAiLessonPlan(courseId, {
          lessonId,
          title,
          instruction,
        }),
      );
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Не удалось подготовить план урока.",
      );
    } finally {
      setPlanning(false);
    }
  }

  async function apply() {
    if (!preview || planning || disabled) return;
    let appliedLessonId: string | null = null;
    const saved = await runMutation(
      "Добавляем материалы из плана ИИ…",
      async () => {
        const result = await applyAiLessonPlan(courseId, preview);
        appliedLessonId = result.lessonId;
      },
    );
    if (saved && appliedLessonId) onApplied(appliedLessonId);
  }

  return (
    <DialogShell
      title={
        lessonId ? "Дополнить урок с помощью ИИ" : "Создать урок с помощью ИИ"
      }
      description={`ИИ подготовит предварительный план для «${title}». Ничего не сохранится до вашего подтверждения.`}
      onClose={() => {
        if (!planning && !disabled) onClose();
      }}
      panelClassName="max-w-4xl"
    >
      <div className="grid gap-5">
        <label className="block">
          <span className="field-label">Что важно учесть</span>
          <textarea
            autoFocus
            maxLength={2000}
            className="field-input min-h-24 resize-y"
            placeholder="Необязательно: длительность, формат, сложные места, интересы ученика"
            value={instruction}
            disabled={planning || disabled}
            onChange={(event) => {
              setInstruction(event.target.value);
              setPreview(null);
              setLocalError(null);
            }}
          />
        </label>

        {localError ? (
          <p
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
            role="alert"
          >
            {localError}
          </p>
        ) : null}

        {preview ? (
          <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700">
                  Предпросмотр · {preview.plan.components.length} компонентов
                </p>
                <p className="mt-1 text-sm leading-6 text-violet-950">
                  {preview.plan.summary}
                </p>
              </div>
            </div>
            <ol className="mt-4 grid gap-2">
              {preview.plan.components.map((component, index) => (
                <li
                  key={`${component.typeKey}-${index}`}
                  className="rounded-xl border border-violet-100 bg-white text-sm text-neutral-800"
                >
                  <details>
                    <summary className="cursor-pointer px-3 py-2 marker:text-violet-500">
                      <span className="font-bold">
                        {index + 1}.{" "}
                        {getComponentDefinition(component.typeKey).title}
                      </span>{" "}
                      <span className="text-neutral-500">
                        — {compactPreview(componentPreview(component))}
                      </span>
                    </summary>
                    <div className="border-t border-violet-100 px-4 py-3 leading-6 text-neutral-700">
                      <AiComponentContent component={component} />
                    </div>
                  </details>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs leading-5 text-violet-800">
              Компоненты создадутся приватными: преподаватель проверит их и сам
              назначит нужные на экран ученика. Использовано токенов:{" "}
              {preview.usage.totalTokens.toLocaleString("ru-RU")}.
              {preview.sharedHistoryUsed
                ? " ИИ также использовал разрешённую владельцем общую учебную историю в обезличенном виде."
                : " Общая история других преподавателей не использовалась."}
            </p>
          </section>
        ) : null}

        <div className="dialog-shell-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={planning || disabled}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button
            type="button"
            variant={preview ? "secondary" : "primary"}
            disabled={planning || disabled}
            onClick={() => void plan()}
          >
            {planning ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : preview ? (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <WandSparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {planning
              ? "ИИ готовит план…"
              : preview
                ? "Составить заново"
                : "Подготовить план"}
          </Button>
          {preview ? (
            <Button
              type="button"
              disabled={planning || disabled}
              onClick={() => void apply()}
            >
              <WandSparkles className="h-4 w-4" aria-hidden="true" />
              {lessonId ? "Добавить в урок" : "Создать урок"}
            </Button>
          ) : null}
        </div>
      </div>
    </DialogShell>
  );
}
