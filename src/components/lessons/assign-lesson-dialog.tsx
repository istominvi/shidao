"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

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
    <button
      type="submit"
      className="landing-btn landing-btn-primary h-10 cursor-pointer text-xs"
      disabled={pending}
    >
      {pending ? "Назначаем..." : "Назначить"}
    </button>
  );
}

export function AssignLessonDialog({
  lessonTitle,
  groups,
  action,
  defaultOpen = false,
  triggerContent = "Назначить урок",
  triggerClassName = "landing-btn landing-btn-primary text-xs",
}: AssignLessonDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [format, setFormat] = useState<"online" | "offline">("online");

  return (
    <>
      <button
        type="button"
        className={`${triggerClassName} cursor-pointer`}
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
              <label className="space-y-1 text-sm text-neutral-700 md:col-span-2">
                <span>Группа</span>
                <select name="classId" required className="field-input" defaultValue="">
                  <option value="" disabled>
                    Выберите группу
                  </option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Дата</span>
                <input type="date" name="date" required className="field-input" />
              </label>
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Время</span>
                <input type="time" name="time" required className="field-input" />
              </label>
              <fieldset className="space-y-2 text-sm text-neutral-700 md:col-span-2">
                <legend>Формат</legend>
                <input type="hidden" name="format" value={format} />
                <div className="inline-flex h-10 items-center rounded-full border border-neutral-200 bg-neutral-100 p-1">
                  <button
                    type="button"
                    className={`h-8 cursor-pointer rounded-full px-4 text-xs font-semibold transition ${
                      format === "online"
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600"
                    }`}
                    onClick={() => setFormat("online")}
                  >
                    online
                  </button>
                  <button
                    type="button"
                    className={`h-8 cursor-pointer rounded-full px-4 text-xs font-semibold transition ${
                      format === "offline"
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-600"
                    }`}
                    onClick={() => setFormat("offline")}
                  >
                    offline
                  </button>
                </div>
              </fieldset>
              {format === "online" ? (
                <label className="space-y-1 text-sm text-neutral-700 md:col-span-2">
                  <span>Ссылка на встречу</span>
                  <input
                    type="url"
                    name="meetingLink"
                    className="field-input"
                    placeholder="https://"
                  />
                  <input type="hidden" name="place" value="" />
                </label>
              ) : (
                <label className="space-y-1 text-sm text-neutral-700 md:col-span-2">
                  <span>Место</span>
                  <input
                    type="text"
                    name="place"
                    className="field-input"
                    placeholder="Кабинет / адрес"
                  />
                  <input type="hidden" name="meetingLink" value="" />
                </label>
              )}
              <div className="mt-3 flex justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="landing-btn landing-btn-muted h-10 cursor-pointer text-xs"
                >
                  Отмена
                </button>
                <SubmitButton />
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
