"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CreateStudentDialogProps = {
  action: (formData: FormData) => Promise<void>;
  defaultOpen?: boolean;
  triggerContent?: ReactNode;
  triggerClassName?: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Создаём..." : "Создать ученика"}</Button>;
}

export function CreateStudentDialog({
  action,
  defaultOpen = false,
  triggerContent = "Добавить ученика",
  triggerClassName,
}: CreateStudentDialogProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        className={triggerClassName ?? productButtonClassName("secondary")}
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
            <h2 className="text-2xl font-bold text-neutral-950">Добавить ученика</h2>
            <form action={action} className="mt-4 grid gap-3">
              <label className="space-y-2 text-sm text-neutral-700">
                <span>Имя</span>
                <Input name="fullName" placeholder="Например, Анна Иванова" />
              </label>
              <label className="space-y-2 text-sm text-neutral-700">
                <span>Логин</span>
                <Input name="login" required placeholder="anna.ivanova" />
              </label>
              <label className="space-y-2 text-sm text-neutral-700">
                <span>Пароль</span>
                <Input name="password" type="password" required minLength={8} />
              </label>
              <div className="mt-3 flex justify-end gap-2">
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
