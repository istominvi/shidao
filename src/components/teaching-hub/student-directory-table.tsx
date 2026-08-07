"use client";

import { Users } from "lucide-react";
import { Chip } from "@/components/ui/chip";
import {
  ProductTable,
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
        colSpan={2}
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
  onOpen,
}: {
  entries: LearnerDirectoryEntry[];
  hasFilters: boolean;
  disabled: boolean;
  onOpen: (profile: LearnerProfile) => void;
}) {
  return (
    <div className="student-directory-table-wrap">
      <ProductTable className="student-directory-table">
        <caption className="sr-only">Ученики и их группы</caption>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell className="w-[42%]">
              Ученик
            </ProductTableHeaderCell>
            <ProductTableHeaderCell>Группы</ProductTableHeaderCell>
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {entries.length === 0 ? (
            <EmptyTableRow
              message={hasFilters ? "Ничего не найдено" : "Учеников пока нет"}
            />
          ) : (
            entries.map(({ profile, groups }) => {
              const orderedGroups = [...groups].sort((left, right) =>
                left.name.localeCompare(right.name, "ru"),
              );
              const visibleGroups = orderedGroups.slice(0, 2);
              const hiddenGroupCount =
                orderedGroups.length - visibleGroups.length;

              return (
                <ProductTableRow
                  key={profile.id}
                  className="student-directory-clickable-row"
                  onClick={() => {
                    if (!disabled) onOpen(profile);
                  }}
                >
                  <ProductTablePrimaryCell>
                    <button
                      type="button"
                      className="student-directory-person student-directory-row-trigger"
                      disabled={disabled}
                      aria-label={`Профиль ученика ${profile.displayName}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(profile);
                      }}
                    >
                      <span
                        className="teaching-learner-avatar"
                        aria-hidden="true"
                      >
                        {initials(profile.displayName)}
                      </span>
                      <strong>{profile.displayName}</strong>
                    </button>
                  </ProductTablePrimaryCell>
                  <ProductTableCell>
                    {groups.length > 0 ? (
                      <span
                        className="student-directory-chips"
                        title={orderedGroups
                          .map((group) => group.name)
                          .join(", ")}
                        aria-label={`Группы: ${orderedGroups
                          .map((group) => group.name)
                          .join(", ")}`}
                      >
                        {visibleGroups.map((group) => (
                          <Chip key={group.id} tone="sky">
                            {group.name}
                          </Chip>
                        ))}
                        {hiddenGroupCount > 0 ? (
                          <Chip tone="neutral">ещё {hiddenGroupCount}</Chip>
                        ) : null}
                      </span>
                    ) : (
                      <span className="student-directory-muted">
                        Без группы
                      </span>
                    )}
                  </ProductTableCell>
                </ProductTableRow>
              );
            })
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
  onOpen,
}: {
  groups: LearnerGroup[];
  hasFilters: boolean;
  disabled: boolean;
  onOpen: (group: LearnerGroup) => void;
}) {
  return (
    <div className="student-directory-table-wrap">
      <ProductTable className="student-directory-table">
        <caption className="sr-only">Группы учеников</caption>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell className="w-[42%]">
              Группа
            </ProductTableHeaderCell>
            <ProductTableHeaderCell>Ученики</ProductTableHeaderCell>
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
                <ProductTableRow
                  key={group.id}
                  className="student-directory-clickable-row"
                  onClick={() => {
                    if (!disabled) onOpen(group);
                  }}
                >
                  <ProductTablePrimaryCell>
                    <button
                      type="button"
                      className="student-directory-person student-directory-row-trigger"
                      disabled={disabled}
                      aria-label={`Группа ${group.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(group);
                      }}
                    >
                      <span
                        className="student-directory-group-icon"
                        aria-hidden="true"
                      >
                        <Users className="h-4 w-4" />
                      </span>
                      <strong>{group.name}</strong>
                    </button>
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
                </ProductTableRow>
              );
            })
          )}
        </ProductTableBody>
      </ProductTable>
    </div>
  );
}
