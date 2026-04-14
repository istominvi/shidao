"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { ProductTableCard } from "@/components/dashboard/product-table-card";
import {
  ProductTable,
  ProductTableBody,
  ProductTableCell,
  ProductTableEmptyState,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTablePrimaryCell,
  ProductTableRow,
  ProductTableTruncate,
} from "@/components/ui/product-table";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { FieldLabel, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type GroupStudentRow = {
  id: string;
  displayName: string;
  login: string | null;
  progressLabel: string;
  communicationHref: string;
};

type GroupStudentsCardProps = {
  students: GroupStudentRow[];
  headerActions: ReactNode;
  updateAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
};

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? "Сохраняем..." : "Сохранить"}</Button>;
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending} className="border-rose-300 text-rose-700 hover:bg-rose-50">
      {pending ? "Удаляем..." : "Удалить из группы"}
    </Button>
  );
}

export function GroupStudentsCard({ students, headerActions, updateAction, removeAction }: GroupStudentsCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedId) ?? null,
    [selectedId, students],
  );

  return (
    <>
      <ProductTableCard
        title="Ученики"
        controls={<div className="flex flex-wrap items-center gap-2">{headerActions}</div>}
      >
        <ProductTable>
          <ProductTableHead>
            <ProductTableHeaderRow>
              <ProductTableHeaderCell>Ученик</ProductTableHeaderCell>
              <ProductTableHeaderCell>Логин</ProductTableHeaderCell>
              <ProductTableHeaderCell>Успеваемость</ProductTableHeaderCell>
            </ProductTableHeaderRow>
          </ProductTableHead>
          <ProductTableBody>
            {students.map((student) => (
              <ProductTableRow
                key={student.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(student.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(student.id);
                  }
                }}
              >
                <ProductTablePrimaryCell className="max-w-0">
                  <ProductTableTruncate title={student.displayName}>{student.displayName}</ProductTableTruncate>
                </ProductTablePrimaryCell>
                <ProductTableCell className="max-w-0">
                  <ProductTableTruncate title={student.login ? `@${student.login}` : "—"}>
                    {student.login ? `@${student.login}` : "—"}
                  </ProductTableTruncate>
                </ProductTableCell>
                <ProductTableCell>
                  <ProductTableTruncate title={student.progressLabel}>{student.progressLabel}</ProductTableTruncate>
                </ProductTableCell>
              </ProductTableRow>
            ))}
          </ProductTableBody>
        </ProductTable>
        {students.length === 0 ? (
          <ProductTableEmptyState text="В группе пока нет учеников." />
        ) : null}
      </ProductTableCard>

      {selectedStudent ? (
        <DialogShell
          onClose={() => setSelectedId(null)}
          title="Ученик"
          description="Измените данные ученика, перейдите в коммуникацию или удалите ученика из группы."
          panelClassName="max-w-xl"
        >
          <form action={updateAction} className="mt-4 grid gap-3">
            <input type="hidden" name="studentId" value={selectedStudent.id} />
            <FormField>
              <FieldLabel htmlFor="group-student-full-name">Имя</FieldLabel>
              <Input id="group-student-full-name" name="fullName" defaultValue={selectedStudent.displayName} placeholder="Например, Анна Иванова" />
            </FormField>
            <FormField>
              <FieldLabel htmlFor="group-student-login">Логин</FieldLabel>
              <Input id="group-student-login" name="login" required defaultValue={selectedStudent.login ?? ""} placeholder="anna.ivanova" />
            </FormField>
            <FormField>
              <FieldLabel htmlFor="group-student-password">Новый пароль</FieldLabel>
              <Input id="group-student-password" name="password" type="password" minLength={8} placeholder="Оставьте пустым, если не меняется" />
            </FormField>
            <div className="dialog-shell-actions flex-wrap">
              <Link href={selectedStudent.communicationHref} className="inline-flex h-10 items-center rounded-xl border border-neutral-300 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-100">
                Написать ученику
              </Link>
              <Button type="button" variant="secondary" onClick={() => setSelectedId(null)}>
                Отмена
              </Button>
              <SaveButton />
            </div>
          </form>

          <form action={removeAction} className="dialog-shell-actions !mt-2">
            <input type="hidden" name="studentId" value={selectedStudent.id} />
            <RemoveButton />
          </form>
        </DialogShell>
      ) : null}
    </>
  );
}
