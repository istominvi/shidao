"use client";

import { Bot, LoaderCircle, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type { AiCoursePlanPreview } from "@/modules/ai/course-builder-contracts";

export function AiCoursePlanDialog({
  preview,
  applying,
  onClose,
  onApply,
}: {
  preview: AiCoursePlanPreview;
  applying: boolean;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <DialogShell
      title="Программа курса от ИИ"
      description="Проверьте последовательность. Уроки сохранятся только после подтверждения."
      onClose={() => {
        if (!applying) onClose();
      }}
      panelClassName="max-w-4xl"
    >
      <div className="grid gap-5">
        <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-bold text-violet-950">
              Подготовлено уроков: {preview.plan.lessons.length}
            </p>
            <p className="mt-1 text-xs leading-5 text-violet-800">
              Модель: {preview.model}. Использовано токенов:{" "}
              {preview.usage.totalTokens.toLocaleString("ru-RU")}.
            </p>
          </div>
        </div>

        <ol className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {preview.plan.lessons.map((lesson, index) => (
            <li
              key={`${index}-${lesson.title}`}
              className="rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <p className="font-bold text-neutral-950">
                {index + 1}. {lesson.title}
              </p>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                {lesson.summary}
              </p>
            </li>
          ))}
        </ol>

        <p className="text-xs leading-5 text-neutral-500">
          Это программа курса. Содержимое каждого урока можно затем заполнить ИИ
          и отдельно проверить перед сохранением.
        </p>

        <div className="dialog-shell-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={applying}
            onClick={onClose}
          >
            Вернуться к форме
          </Button>
          <Button type="button" disabled={applying} onClick={onApply}>
            {applying ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <WandSparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {applying ? "Сохраняем программу…" : "Создать программу курса"}
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}
