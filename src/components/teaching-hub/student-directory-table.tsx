"use client";

import { History, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  ProductTable,
  ProductTableActionCell,
  ProductTableBody,
  ProductTableCell,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTablePrimaryCell,
  ProductTableRow,
} from "@/components/ui/product-table";
import type {
  LearnerGroup,
  LearnerProfile,
} from "@/modules/lesson-runs/domain";

export type LearnerDirectoryEntry = {
  profile: LearnerProfile;
  groups: LearnerGroup[];
};

function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("ru-RU"))
    .join("");
}

function learnerCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ученик`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} ученика`;
  }
  return `${count} учеников`;
}

function EmptyTableRow({ message }: { message: string }) {
  return (
    <ProductTableRow className="hover:bg-transparent">
      <ProductTableCell
        colSpan={3}
        className="h-28 text-center text-neutral-500"
      >
        {message}
      </ProductTableCell>
    </ProductTableRow>
  );
}

export function LearnersDirectoryTable({
  entries,
  hasFilters,
  disabled,
  onHistory,
  onEdit,
  onDelete,
}: {
  entries: LearnerDirectoryEntry[];
  hasFilters: boolean;
  disabled: boolean;
  onHistory: (profile: LearnerProfile) => void;
  onEdit: (profile: LearnerProfile) => void;
  onDelete: (profile: LearnerProfile) => void;
}) {
  return (
    <div className="student-directory-table-wrap">
      <ProductTable className="student-directory-table">
        <caption className="sr-only">Ученики и их группы</caption>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell className="w-[34%]">
              Ученик
            </ProductTableHeaderCell>
            <ProductTableHeaderCell>Группы</ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[22%] text-right">
              Действия
            </ProductTableHeaderCell>
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {entries.length === 0 ? (
            <EmptyTableRow
              message={hasFilters ? "Ничего не найдено" : "Учеников пока нет"}
            />
          ) : (
            entries.map(({ profile, groups }) => (
              <ProductTableRow key={profile.id}>
                <ProductTablePrimaryCell>
                  <span className="student-directory-person">
                    <span
                      className="teaching-learner-avatar"
                      aria-hidden="true"
                    >
                      {initials(profile.displayName)}
                    </span>
                    <strong>{profile.displayName}</strong>
                  </span>
                </ProductTablePrimaryCell>
                <ProductTableCell>
                  {groups.length > 0 ? (
                    <span className="student-directory-chips">
                      {groups.map((group) => (
                        <Chip key={group.id} tone="sky">
                          {group.name}
                        </Chip>
                      ))}
                    </span>
                  ) : (
                    <span className="student-directory-muted">Без группы</span>
                  )}
                </ProductTableCell>
                <ProductTableActionCell>
                  <span className="student-directory-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      className="student-directory-action"
                      disabled={disabled}
                      aria-label={`История ученика ${profile.displayName}`}
                      onClick={() => onHistory(profile)}
                    >
                      <History className="h-4 w-4" aria-hidden="true" />
                      История
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="student-directory-action"
                      disabled={disabled}
                      aria-label={`Редактировать ученика ${profile.displayName}`}
                      onClick={() => onEdit(profile)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Редактировать
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="student-directory-action product-btn-danger"
                      disabled={disabled}
                      aria-label={`Удалить ученика ${profile.displayName}`}
                      onClick={() => onDelete(profile)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Удалить
                    </Button>
                  </span>
                </ProductTableActionCell>
              </ProductTableRow>
            ))
          )}
        </ProductTableBody>
      </ProductTable>
    </div>
  );
}

export function LearnerGroupsDirectoryTable({
  groups,
  hasFilters,
  disabled,
  onEdit,
  onDelete,
}: {
  groups: LearnerGroup[];
  hasFilters: boolean;
  disabled: boolean;
  onEdit: (group: LearnerGroup) => void;
  onDelete: (group: LearnerGroup) => void;
}) {
  return (
    <div className="student-directory-table-wrap">
      <ProductTable className="student-directory-table">
        <caption className="sr-only">Группы учеников</caption>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell className="w-[34%]">
              Группа
            </ProductTableHeaderCell>
            <ProductTableHeaderCell>Ученики</ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[22%] text-right">
              Действия
            </ProductTableHeaderCell>
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {groups.length === 0 ? (
            <EmptyTableRow
              message={hasFilters ? "Ничего не найдено" : "Групп пока нет"}
            />
          ) : (
            groups.map((group) => {
              const members = [...group.members].sort((left, right) =>
                left.displayName.localeCompare(right.displayName, "ru"),
              );
              const preview = members
                .slice(0, 4)
                .map((member) => member.displayName)
                .join(", ");
              return (
                <ProductTableRow key={group.id}>
                  <ProductTablePrimaryCell>
                    <span className="student-directory-person">
                      <span
                        className="student-directory-group-icon"
                        aria-hidden="true"
                      >
                        <Users className="h-4 w-4" />
                      </span>
                      <strong>{group.name}</strong>
                    </span>
                  </ProductTablePrimaryCell>
                  <ProductTableCell>
                    <span className="student-directory-members">
                      <strong>{learnerCountLabel(members.length)}</strong>
                      {members.length > 0 ? (
                        <small>
                          {preview}
                          {members.length > 4
                            ? ` и ещё ${members.length - 4}`
                            : ""}
                        </small>
                      ) : (
                        <small>Нет учеников</small>
                      )}
                    </span>
                  </ProductTableCell>
                  <ProductTableActionCell>
                    <span className="student-directory-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        className="student-directory-action"
                        disabled={disabled}
                        aria-label={`Редактировать группу ${group.name}`}
                        onClick={() => onEdit(group)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Редактировать
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="student-directory-action product-btn-danger"
                        disabled={disabled}
                        aria-label={`Удалить группу ${group.name}`}
                        onClick={() => onDelete(group)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Удалить
                      </Button>
                    </span>
                  </ProductTableActionCell>
                </ProductTableRow>
              );
            })
          )}
        </ProductTableBody>
      </ProductTable>
    </div>
  );
}
