"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { FieldHint, FieldLabel, FormField } from "@/components/ui/form-field";
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
              <FieldHint>Минимум 8 символов.</FieldHint>
            </FormField>
            <div className="mt-3 flex justify-end gap-2">
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
