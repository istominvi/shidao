"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { ChevronDown, MapPin, MonitorPlay } from "lucide-react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { FieldControl, FieldLabel, FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";

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
        <DialogShell
          onClose={() => setOpen(false)}
          title="Назначить урок"
          description={lessonTitle}
          panelClassName="max-w-xl"
        >
          <form action={action} className="grid gap-3 md:grid-cols-2">
            <FormField className="md:col-span-2">
              <FieldLabel htmlFor="assign-class-id">Группа</FieldLabel>
              <FieldControl className="product-select-wrap">
                <Select id="assign-class-id" name="classId" required defaultValue="">
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
              </FieldControl>
            </FormField>
            <FormField>
              <FieldLabel htmlFor="assign-date">Дата</FieldLabel>
              <Input id="assign-date" type="date" name="date" required />
            </FormField>
            <FormField>
              <FieldLabel htmlFor="assign-time">Время</FieldLabel>
              <Input id="assign-time" type="time" name="time" required />
            </FormField>
            <fieldset className="space-y-2.5 md:col-span-2">
              <legend className="form-field-label mb-1 block">Формат</legend>
              <input type="hidden" name="format" value={format} />
              <SegmentedControl
                ariaLabel="Формат занятия"
                value={format}
                onChange={setFormat}
                items={[
                  { value: "online", label: "Онлайн", icon: MonitorPlay },
                  { value: "offline", label: "Офлайн", icon: MapPin },
                ]}
              />
            </fieldset>
            {format === "online" ? (
              <FormField className="md:col-span-2">
                <FieldLabel htmlFor="assign-meeting-link">Ссылка на встречу</FieldLabel>
                <Input id="assign-meeting-link" type="url" name="meetingLink" placeholder="https://" />
                <input type="hidden" name="place" value="" />
              </FormField>
            ) : (
              <FormField className="md:col-span-2">
                <FieldLabel htmlFor="assign-place">Место</FieldLabel>
                <Input id="assign-place" type="text" name="place" placeholder="Кабинет / адрес" />
                <input type="hidden" name="meetingLink" value="" />
              </FormField>
            )}
            <div className="dialog-shell-actions md:col-span-2">
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
