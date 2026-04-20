"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { FieldLabel, FormField } from "@/components/ui/form-field";
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
  const [parentOpen, setParentOpen] = useState(false);

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
        <DialogShell onClose={() => setOpen(false)} title="Добавить ученика" panelClassName="max-w-xl">
          <form action={action} className="grid gap-3">
            <FormField>
              <FieldLabel htmlFor="create-student-name">Имя</FieldLabel>
              <Input id="create-student-name" name="fullName" placeholder="Например, Анна Иванова" />
            </FormField>
            <FormField>
              <FieldLabel htmlFor="create-student-login">Логин</FieldLabel>
              <Input id="create-student-login" name="login" required placeholder="anna.ivanova" />
            </FormField>
            <FormField>
              <FieldLabel htmlFor="create-student-password">Пароль</FieldLabel>
              <Input id="create-student-password" name="password" type="password" required minLength={8} />
            </FormField>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-neutral-900">Родитель</p>
                {!parentOpen ? (
                  <Button type="button" variant="secondary" onClick={() => setParentOpen(true)}>
                    Привязать родителя
                  </Button>
                ) : null}
              </div>
              {parentOpen ? (
                <div className="mt-3 grid gap-3">
                  <FormField>
                    <FieldLabel htmlFor="create-student-parent-email">Email родителя</FieldLabel>
                    <Input id="create-student-parent-email" name="parentEmail" type="email" placeholder="parent@example.com" />
                  </FormField>
                  <FormField>
                    <FieldLabel htmlFor="create-student-parent-name">ФИО родителя (optional)</FieldLabel>
                    <Input id="create-student-parent-name" name="parentFullName" placeholder="Например, Мария Иванова" />
                  </FormField>
                  <p className="text-xs text-neutral-600">
                    Если родитель уже зарегистрирован, ученик появится в его кабинете. Можно оставить пустым.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="dialog-shell-actions">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <SubmitButton />
            </div>
          </form>
        </DialogShell>
      ) : null}
    </>
  );
}
