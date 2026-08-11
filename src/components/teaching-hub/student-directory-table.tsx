"use client";

import { RotateCcw, Trash2, Users, XCircle } from "lucide-react";
import {
  IdentityStateBadge,
  RequestStatusBadge,
} from "@/components/learner-identity/identity-ui";
import { Button } from "@/components/ui/button";
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
import type {
  LearnerConnectionRequest,
  TeacherLearnerDirectoryItem,
} from "@/modules/learner-identity/domain";

export type LearnerDirectoryEntry =
  | {
      kind: "profile";
      status: "active" | "archived";
      profile: LearnerProfile;
      groups: LearnerGroup[];
      identity: TeacherLearnerDirectoryItem;
    }
  | {
      kind: "request";
      status: "pending";
      request: LearnerConnectionRequest;
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

function EmptyTableRow({
  message,
  colSpan,
}: {
  message: string;
  colSpan: number;
}) {
  return (
    <ProductTableRow className="hover:bg-transparent">
      <ProductTableCell
        colSpan={colSpan}
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
  onRestore,
  onPermanentlyDelete,
  onCancelRequest,
}: {
  entries: LearnerDirectoryEntry[];
  hasFilters: boolean;
  disabled: boolean;
  onOpen: (profile: LearnerProfile) => void;
  onRestore: (learner: TeacherLearnerDirectoryItem) => void;
  onPermanentlyDelete: (learner: TeacherLearnerDirectoryItem) => void;
  onCancelRequest: (request: LearnerConnectionRequest) => void;
}) {
  return (
    <div className="product-table-wrap student-directory-table-wrap">
      <ProductTable className="student-directory-table student-directory-learners-table">
        <caption className="sr-only">Ученики, их статусы и группы</caption>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell className="w-[42%]">
              Ученик
            </ProductTableHeaderCell>
            <ProductTableHeaderCell>Группы</ProductTableHeaderCell>
            <ProductTableHeaderCell className="student-directory-actions-column text-right">
              <span className="sr-only">Действия</span>
            </ProductTableHeaderCell>
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {entries.length === 0 ? (
            <EmptyTableRow
              message={hasFilters ? "Ничего не найдено" : "Учеников пока нет"}
              colSpan={3}
            />
          ) : (
            entries.map((entry) => {
              const displayName =
                entry.kind === "profile"
                  ? entry.profile.displayName
                  : (entry.request.localDisplayName ?? "Новый ученик");
              const canOpen =
                entry.kind === "profile" && entry.status === "active";
              const groups = entry.groups;
              const orderedGroups = [...groups].sort((left, right) =>
                left.name.localeCompare(right.name, "ru"),
              );
              const visibleGroups = orderedGroups.slice(0, 2);
              const hiddenGroupCount =
                orderedGroups.length - visibleGroups.length;

              return (
                <ProductTableRow
                  key={
                    entry.kind === "profile"
                      ? `profile-${entry.profile.id}`
                      : `request-${entry.request.id}`
                  }
                  className={
                    canOpen ? "student-directory-clickable-row" : undefined
                  }
                  onClick={() => {
                    if (!disabled && canOpen && entry.kind === "profile") {
                      onOpen(entry.profile);
                    }
                  }}
                >
                  <ProductTablePrimaryCell>
                    {canOpen && entry.kind === "profile" ? (
                      <button
                        type="button"
                        className="student-directory-person student-directory-row-trigger"
                        disabled={disabled}
                        aria-label={`Профиль ученика ${displayName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(entry.profile);
                        }}
                      >
                        <span
                          className="teaching-learner-avatar"
                          aria-hidden="true"
                        >
                          {initials(displayName)}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <strong>{displayName}</strong>
                          <IdentityStateBadge
                            state={entry.identity.identityState}
                          />
                        </span>
                      </button>
                    ) : (
                      <span className="student-directory-person">
                        <span
                          className="teaching-learner-avatar"
                          aria-hidden="true"
                        >
                          {initials(displayName)}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <strong>{displayName}</strong>
                          {entry.kind === "profile" ? (
                            <>
                              <Chip tone="slate">В архиве</Chip>
                              <IdentityStateBadge
                                state={entry.identity.identityState}
                              />
                            </>
                          ) : (
                            <RequestStatusBadge status={entry.request.status} />
                          )}
                        </span>
                      </span>
                    )}
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
                  <ProductTableCell className="student-directory-actions-column">
                    <span className="student-directory-actions">
                      {entry.kind === "profile" &&
                      entry.status === "archived" ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            className="student-directory-action student-directory-icon-action"
                            disabled={disabled}
                            aria-label={`Восстановить ученика ${displayName}`}
                            title={`Восстановить ученика ${displayName}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              onRestore(entry.identity);
                            }}
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          {entry.identity.canPermanentlyDelete ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="student-directory-action student-directory-icon-action product-btn-danger"
                              disabled={disabled}
                              aria-label={`Удалить пустой профиль ${displayName}`}
                              title={`Удалить пустой профиль ${displayName}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                onPermanentlyDelete(entry.identity);
                              }}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          ) : null}
                        </>
                      ) : entry.kind === "request" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="student-directory-action student-directory-icon-action"
                          disabled={disabled}
                          aria-label={`Отменить запрос для ${displayName}`}
                          title={`Отменить запрос для ${displayName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onCancelRequest(entry.request);
                          }}
                        >
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      ) : null}
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
    <div className="product-table-wrap student-directory-table-wrap">
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
              colSpan={2}
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
