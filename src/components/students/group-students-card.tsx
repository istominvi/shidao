"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { TeacherTableCard, TeacherTableEmptyState } from "@/components/dashboard/teacher-table-card";
import {
  ProductTable,
  ProductTableBody,
  ProductTableCell,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTablePrimaryCell,
  ProductTableRow,
  ProductTableTruncate,
} from "@/components/ui/product-table";
import { Button } from "@/components/ui/button";
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
      <TeacherTableCard
        title={undefined}
        headerAction={<div className="flex flex-wrap items-center justify-start gap-2">{headerActions}</div>}
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
          <TeacherTableEmptyState text="В группе пока нет учеников." />
        ) : null}
      </TeacherTableCard>

      {selectedStudent ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <button
            aria-label="Закрыть"
            className="absolute inset-0 bg-neutral-950/40"
            onClick={() => setSelectedId(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-xl rounded-3xl border border-white/80 bg-white px-6 py-5 shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-neutral-950">Ученик</h2>
            <p className="mt-1 text-sm text-neutral-500">Измените данные ученика, перейдите в коммуникацию или удалите ученика из группы.</p>

            <form action={updateAction} className="mt-4 grid gap-3">
              <input type="hidden" name="studentId" value={selectedStudent.id} />
              <label className="space-y-2 text-sm text-neutral-700">
                <span>Имя</span>
                <Input name="fullName" defaultValue={selectedStudent.displayName} placeholder="Например, Анна Иванова" />
              </label>
              <label className="space-y-2 text-sm text-neutral-700">
                <span>Логин</span>
                <Input name="login" required defaultValue={selectedStudent.login ?? ""} placeholder="anna.ivanova" />
              </label>
              <label className="space-y-2 text-sm text-neutral-700">
                <span>Новый пароль</span>
                <Input name="password" type="password" minLength={8} placeholder="Оставьте пустым, если не меняется" />
              </label>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Link href={selectedStudent.communicationHref} className="inline-flex h-11 items-center rounded-full border border-neutral-300 px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-100">
                  Написать ученику
                </Link>
                <Button type="button" variant="secondary" onClick={() => setSelectedId(null)}>
                  Отмена
                </Button>
                <SaveButton />
              </div>
            </form>

            <form action={removeAction} className="mt-3 flex justify-end">
              <input type="hidden" name="studentId" value={selectedStudent.id} />
              <RemoveButton />
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
