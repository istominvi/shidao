"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { ChevronDown, MapPin, MonitorPlay } from "lucide-react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

type AssignLessonDialogProps = {
  lessonTitle: string;
  groups: Array<{ id: string; label: string }>;
  action: (formData: FormData) => Promise<void>;
  defaultOpen?: boolean;
  triggerContent?: ReactNode;
  triggerClassName?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Назначаем..." : "Назначить"}
    </Button>
  );
}

export function AssignLessonDialog({
  lessonTitle,
  groups,
  action,
  defaultOpen = false,
  triggerContent = "Назначить урок",
  triggerClassName,
}: AssignLessonDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [format, setFormat] = useState<"online" | "offline">("online");

  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? productButtonClassName("primary")}
        onClick={() => setOpen(true)}
      >
        {triggerContent}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            aria-label="Закрыть"
            className="absolute inset-0 bg-neutral-950/40"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-xl rounded-3xl border border-white/80 bg-white px-6 py-5 shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-neutral-950">Назначить урок</h2>
            <p className="mt-2 text-sm text-neutral-700">{lessonTitle}</p>
            <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm text-neutral-700 md:col-span-2">
                <span>Группа</span>
                <span className="product-select-wrap block">
                  <Select name="classId" required defaultValue="">
                    <option value="" disabled>
                      Выберите группу
                    </option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </Select>
                  <ChevronDown className="product-select-icon h-4 w-4" aria-hidden="true" />
                </span>
              </label>
              <label className="space-y-2 text-sm text-neutral-700">
                <span>Дата</span>
                <Input type="date" name="date" required />
              </label>
              <label className="space-y-2 text-sm text-neutral-700">
                <span>Время</span>
                <Input type="time" name="time" required />
              </label>
              <fieldset className="space-y-2 text-sm text-neutral-700 md:col-span-2">
                <legend>Формат</legend>
                <input type="hidden" name="format" value={format} />
                <div className="inline-flex h-12 items-center rounded-full border border-neutral-200 bg-neutral-100 p-1">
                  <button
                    type="button"
                    className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition ${
                      format === "online"
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600"
                    }`}
                    onClick={() => setFormat("online")}
                  >
                    <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
                    Онлайн
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition ${
                      format === "offline"
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600"
                    }`}
                    onClick={() => setFormat("offline")}
                  >
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    Офлайн
                  </button>
                </div>
              </fieldset>
              {format === "online" ? (
                <label className="space-y-2 text-sm text-neutral-700 md:col-span-2">
                  <span>Ссылка на встречу</span>
                  <Input type="url" name="meetingLink" placeholder="https://" />
                  <input type="hidden" name="place" value="" />
                </label>
              ) : (
                <label className="space-y-2 text-sm text-neutral-700 md:col-span-2">
                  <span>Место</span>
                  <Input type="text" name="place" placeholder="Кабинет / адрес" />
                  <input type="hidden" name="meetingLink" value="" />
                </label>
              )}
              <div className="mt-3 flex justify-end gap-2 md:col-span-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Отмена
                </Button>
                <SubmitButton />
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
