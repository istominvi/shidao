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
  return <button type="submit" className="landing-btn landing-btn-primary text-xs" disabled={pending}>{pending ? "Назначаем..." : "Создать и открыть урок"}</button>;
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

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>{triggerContent}</button>
      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button aria-label="Закрыть" className="absolute inset-0 bg-neutral-950/40" onClick={() => setOpen(false)} />
          <section role="dialog" aria-modal="true" className="relative z-10 w-full max-w-xl rounded-3xl border border-white/80 bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-neutral-950">Назначить урок</h2>
            <p className="mt-2 text-sm text-neutral-700">Урок: {lessonTitle}</p>
            <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Группа</span>
                <select name="classId" required className="field-input" defaultValue="">
                  <option value="" disabled>Выберите группу</option>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm text-neutral-700"><span>Формат</span><select name="format" required className="field-input" defaultValue="online"><option value="online">online</option><option value="offline">offline</option></select></label>
              <label className="space-y-1 text-sm text-neutral-700"><span>Дата</span><input type="date" name="date" required className="field-input" /></label>
              <label className="space-y-1 text-sm text-neutral-700"><span>Время</span><input type="time" name="time" required className="field-input" /></label>
              <label className="space-y-1 text-sm text-neutral-700"><span>Ссылка на встречу (для online)</span><input type="url" name="meetingLink" className="field-input" placeholder="https://" /></label>
              <label className="space-y-1 text-sm text-neutral-700"><span>Место (для offline)</span><input type="text" name="place" className="field-input" placeholder="Кабинет / адрес" /></label>
              <div className="md:col-span-2 flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="landing-btn landing-btn-muted text-xs">Отмена</button>
                <SubmitButton />
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
