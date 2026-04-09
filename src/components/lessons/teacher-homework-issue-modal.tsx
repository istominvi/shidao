"use client";

import { useEffect, useMemo, useState } from "react";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-bold text-neutral-900">Задать ДЗ</h3>
        <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
          <p className="font-semibold text-neutral-900">{homeworkSummary.title}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-neutral-500">{homeworkSummary.kindLabel}</p>
          <p className="mt-2 text-neutral-700">{homeworkSummary.instructions}</p>
        </div>

        <form action={action} method="POST" className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="font-semibold text-neutral-900">Кому выдать</span>
            <select
              name="recipientMode"
              value={recipientMode}
              onChange={(event) => setRecipientMode(event.target.value === "selected" ? "selected" : "all")}
              className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2"
            >
              <option value="all">Вся группа</option>
              <option value="selected">Выбранные ученики</option>
            </select>
          </label>

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
                <p className="text-xs text-rose-700">Нужно выбрать хотя бы одного ученика.</p>
              ) : null}
            </fieldset>
          ) : null}

          <label className="block text-sm">
            <span className="font-semibold text-neutral-900">Срок сдачи</span>
            <input name="dueAt" type="datetime-local" className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2" />
          </label>

          <label className="block text-sm">
            <span className="font-semibold text-neutral-900">Комментарий к заданию</span>
            <textarea name="assignmentComment" rows={3} className="mt-1.5 w-full rounded-xl border border-neutral-300 px-3 py-2" placeholder="Например: сделать вместе с родителем" />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-semibold">
              Отмена
            </button>
            <button
              type="submit"
              disabled={selectedModeInvalid}
              className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              Выдать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
