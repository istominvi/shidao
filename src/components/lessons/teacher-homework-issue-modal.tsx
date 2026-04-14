"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { FieldError, FieldLabel, FormField } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";

type Props = {
  open: boolean;
  onClose: () => void;
  action: string;
  students: Array<{ studentId: string; studentName: string }>;
  homeworkSummary: {
    title: string;
    kindLabel: string;
    instructions: string;
  };
};

export function TeacherHomeworkIssueModal({
  open,
  onClose,
  action,
  students,
  homeworkSummary,
}: Props) {
  const [recipientMode, setRecipientMode] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const selectedModeInvalid = useMemo(
    () => recipientMode === "selected" && selectedIds.length === 0,
    [recipientMode, selectedIds.length],
  );

  if (!open) return null;

  return (
    <DialogShell onClose={onClose} title="Задать ДЗ" panelClassName="max-w-2xl">
      <Alert tone="neutral">
        <p className="font-semibold text-neutral-900">{homeworkSummary.title}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-neutral-500">{homeworkSummary.kindLabel}</p>
        <p className="mt-2 text-neutral-700">{homeworkSummary.instructions}</p>
      </Alert>

      <form action={action} method="POST" className="mt-4 space-y-4">
        <FormField>
          <FieldLabel htmlFor="homework-recipient-mode">Кому выдать</FieldLabel>
          <Select
            id="homework-recipient-mode"
            name="recipientMode"
            value={recipientMode}
            onChange={(event) => setRecipientMode(event.target.value === "selected" ? "selected" : "all")}
          >
            <option value="all">Вся группа</option>
            <option value="selected">Выбранные ученики</option>
          </Select>
        </FormField>

        {recipientMode === "selected" ? (
          <fieldset className="space-y-1 rounded-xl border border-neutral-200 p-3">
            <legend className="text-sm font-semibold text-neutral-900">Выберите учеников</legend>
            {students.map((student) => (
              <label key={student.studentId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="studentIds"
                  value={student.studentId}
                  checked={selectedIds.includes(student.studentId)}
                  onChange={(event) => {
                    setSelectedIds((prev) =>
                      event.target.checked
                        ? Array.from(new Set([...prev, student.studentId]))
                        : prev.filter((id) => id !== student.studentId),
                    );
                  }}
                />
                <span>{student.studentName}</span>
              </label>
            ))}
            {selectedModeInvalid ? (
              <FieldError>Нужно выбрать хотя бы одного ученика.</FieldError>
            ) : null}
          </fieldset>
        ) : null}

        <FormField>
          <FieldLabel htmlFor="homework-due-at">Срок сдачи</FieldLabel>
          <Input id="homework-due-at" name="dueAt" type="datetime-local" />
        </FormField>

        <FormField>
          <FieldLabel htmlFor="homework-assignment-comment">Комментарий к заданию</FieldLabel>
          <textarea
            id="homework-assignment-comment"
            name="assignmentComment"
            rows={3}
            className="w-full rounded-xl border border-neutral-300 px-3 py-2"
            placeholder="Например: сделать вместе с родителем"
          />
        </FormField>

        <div className="dialog-shell-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" disabled={selectedModeInvalid}>
            Выдать
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
