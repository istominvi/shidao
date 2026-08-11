"use client";

import {
  Archive,
  BookPlus,
  History,
  Link2,
  MessageSquare,
  MoreVertical,
  RotateCcw,
  Trash2,
  UserRound,
  Users,
  UsersRound,
  XCircle,
} from "lucide-react";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
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
  ProductTableSortableHeaderCell,
  type ProductTableSortState,
} from "@/components/ui/product-table";
import type {
  LearnerGroup,
  LearnerProfile,
} from "@/modules/lesson-runs/domain";
import type {
  LearnerConnectionRequest,
  LearnerIdentityState,
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

export type LearnerDirectorySortKey =
  "name" | "status" | "account" | "groups" | "created";

export type LearnerGroupDirectorySortKey = "name" | "members";

const directoryCollator = new Intl.Collator("ru-RU", {
  numeric: true,
  sensitivity: "base",
});

const directoryStatusOrder: Record<LearnerDirectoryEntry["status"], number> = {
  active: 0,
  pending: 1,
  archived: 2,
};

const identityLabels: Record<LearnerIdentityState, string> = {
  claimed: "Подключён",
  merged: "Объединён",
  offline: "Без аккаунта",
  pending: "Ожидает подключения",
};

const compactDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const fullDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

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

export function learnerDirectoryDisplayName(entry: LearnerDirectoryEntry) {
  return entry.kind === "profile"
    ? entry.profile.displayName
    : (entry.request.localDisplayName ?? "Новый ученик");
}

export function learnerDirectoryStatusLabel(entry: LearnerDirectoryEntry) {
  if (entry.status === "archived") return "В архиве";
  if (entry.status === "pending") return "Ожидает ответа";
  return "Активен";
}

export function learnerDirectoryAccountLabel(entry: LearnerDirectoryEntry) {
  if (entry.kind === "request") {
    return entry.request.method === "email"
      ? "Приглашение по email"
      : "Запрос по коду";
  }
  return identityLabels[entry.identity.identityState];
}

export function learnerDirectoryCreatedAt(entry: LearnerDirectoryEntry) {
  return entry.kind === "profile"
    ? entry.profile.createdAt
    : entry.request.createdAt;
}

function stableEntryKey(entry: LearnerDirectoryEntry) {
  return entry.kind === "profile" ? entry.profile.id : entry.request.id;
}

export function sortLearnerDirectoryEntries(
  entries: LearnerDirectoryEntry[],
  sort: ProductTableSortState<LearnerDirectorySortKey>,
) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...entries].sort((left, right) => {
    let difference = 0;
    if (sort.key === "name") {
      difference = directoryCollator.compare(
        learnerDirectoryDisplayName(left),
        learnerDirectoryDisplayName(right),
      );
    } else if (sort.key === "status") {
      difference =
        directoryStatusOrder[left.status] - directoryStatusOrder[right.status];
    } else if (sort.key === "account") {
      difference = directoryCollator.compare(
        learnerDirectoryAccountLabel(left),
        learnerDirectoryAccountLabel(right),
      );
    } else if (sort.key === "groups") {
      difference = left.groups.length - right.groups.length;
    } else {
      difference =
        new Date(learnerDirectoryCreatedAt(left)).getTime() -
        new Date(learnerDirectoryCreatedAt(right)).getTime();
    }

    if (difference !== 0) return direction * difference;
    const nameDifference = directoryCollator.compare(
      learnerDirectoryDisplayName(left),
      learnerDirectoryDisplayName(right),
    );
    if (nameDifference !== 0) return nameDifference;
    return stableEntryKey(left).localeCompare(stableEntryKey(right));
  });
}

export function sortLearnerGroupsDirectory(
  groups: LearnerGroup[],
  sort: ProductTableSortState<LearnerGroupDirectorySortKey>,
) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...groups].sort((left, right) => {
    const difference =
      sort.key === "members"
        ? left.members.length - right.members.length
        : directoryCollator.compare(left.name, right.name);
    if (difference !== 0) return direction * difference;
    return directoryCollator.compare(left.name, right.name);
  });
}

function formatCompactDate(value: string) {
  const parts = compactDateFormatter.formatToParts(new Date(value));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month =
    parts.find((part) => part.type === "month")?.value.replace(/\.$/u, "") ??
    "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return [day, month, year].filter(Boolean).join(" ");
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
        className="student-directory-empty-cell text-center text-neutral-500"
      >
        {message}
      </ProductTableCell>
    </ProductTableRow>
  );
}

function StatusText({ entry }: { entry: LearnerDirectoryEntry }) {
  return (
    <span
      className={`student-directory-state student-directory-state-${entry.status}`}
    >
      <span aria-hidden="true" />
      {learnerDirectoryStatusLabel(entry)}
    </span>
  );
}

export function LearnersDirectoryTable({
  entries,
  sort,
  onSort,
  hasFilters,
  disabled,
  onOpen,
  onAddToCourse,
  onArchive,
  onRestore,
  onPermanentlyDelete,
  onCancelRequest,
}: {
  entries: LearnerDirectoryEntry[];
  sort: ProductTableSortState<LearnerDirectorySortKey>;
  onSort: (key: LearnerDirectorySortKey) => void;
  hasFilters: boolean;
  disabled: boolean;
  onOpen: (
    profile: LearnerProfile,
    surface: "profile" | "history" | "connection",
  ) => void;
  onAddToCourse: (profile: LearnerProfile) => void;
  onArchive: (profile: LearnerProfile) => void;
  onRestore: (learner: TeacherLearnerDirectoryItem) => void;
  onPermanentlyDelete: (learner: TeacherLearnerDirectoryItem) => void;
  onCancelRequest: (request: LearnerConnectionRequest) => void;
}) {
  const orderedEntries = sortLearnerDirectoryEntries(entries, sort);

  return (
    <div className="product-table-wrap student-directory-table-wrap">
      <ProductTable className="student-directory-table student-directory-learners-table">
        <caption className="sr-only">Ученики, их статусы и группы</caption>
        <colgroup>
          <col className="student-directory-col-name" />
          <col className="student-directory-col-status" />
          <col className="student-directory-col-account" />
          <col className="student-directory-col-groups" />
          <col className="student-directory-col-created" />
          <col className="student-directory-col-actions" />
        </colgroup>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableSortableHeaderCell
              direction={sort.key === "name" ? sort.direction : null}
              onSort={() => onSort("name")}
            >
              Ученик
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "status" ? sort.direction : null}
              onSort={() => onSort("status")}
            >
              Статус
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "account" ? sort.direction : null}
              onSort={() => onSort("account")}
            >
              Аккаунт
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "groups" ? sort.direction : null}
              onSort={() => onSort("groups")}
            >
              Группы
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "created" ? sort.direction : null}
              onSort={() => onSort("created")}
            >
              Добавлен
            </ProductTableSortableHeaderCell>
            <ProductTableHeaderCell
              className="student-directory-actions-column text-right"
              aria-label="Действия"
            />
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {orderedEntries.length === 0 ? (
            <EmptyTableRow
              message={hasFilters ? "Ничего не найдено" : "Учеников пока нет"}
              colSpan={6}
            />
          ) : (
            orderedEntries.map((entry) => {
              const displayName = learnerDirectoryDisplayName(entry);
              const canOpen =
                entry.kind === "profile" && entry.status === "active";
              const orderedGroups = [...entry.groups].sort((left, right) =>
                directoryCollator.compare(left.name, right.name),
              );
              const groupText =
                entry.kind !== "profile" || entry.status !== "active"
                  ? "—"
                  : orderedGroups.length === 0
                    ? "Без группы"
                    : orderedGroups.length <= 2
                      ? orderedGroups.map((group) => group.name).join(", ")
                      : `${orderedGroups
                          .slice(0, 2)
                          .map((group) => group.name)
                          .join(", ")} · ещё ${orderedGroups.length - 2}`;
              const fullGroupText =
                orderedGroups.length > 0
                  ? orderedGroups.map((group) => group.name).join(", ")
                  : groupText;
              const actionItems: ActionMenuItem[] =
                entry.kind === "request"
                  ? [
                      {
                        id: "cancel-request",
                        label: "Отменить запрос",
                        icon: XCircle,
                        destructive: true,
                        disabled,
                        onSelect: () => onCancelRequest(entry.request),
                      },
                    ]
                  : entry.status === "archived"
                    ? [
                        {
                          id: "restore",
                          label: "Восстановить",
                          icon: RotateCcw,
                          disabled,
                          onSelect: () => onRestore(entry.identity),
                        },
                        ...(entry.identity.canPermanentlyDelete
                          ? [
                              {
                                id: "permanent-delete",
                                label: "Удалить пустой профиль",
                                icon: Trash2,
                                destructive: true,
                                separatorBefore: true,
                                disabled,
                                onSelect: () =>
                                  onPermanentlyDelete(entry.identity),
                              } satisfies ActionMenuItem,
                            ]
                          : []),
                      ]
                    : [
                        {
                          id: "open",
                          label: "Открыть профиль",
                          icon: UserRound,
                          disabled,
                          onSelect: () => onOpen(entry.profile, "profile"),
                        },
                        {
                          id: "history",
                          label: "Учебная история",
                          icon: History,
                          disabled,
                          onSelect: () => onOpen(entry.profile, "history"),
                        },
                        {
                          id: "groups",
                          label: "Изменить группы",
                          icon: UsersRound,
                          separatorBefore: true,
                          disabled,
                          onSelect: () => onOpen(entry.profile, "profile"),
                        },
                        {
                          id: "course",
                          label: "Добавить в курс…",
                          icon: BookPlus,
                          disabled,
                          onSelect: () => onAddToCourse(entry.profile),
                        },
                        {
                          id: "connection",
                          label: "Связь с аккаунтом",
                          icon: Link2,
                          disabled,
                          onSelect: () => onOpen(entry.profile, "connection"),
                        },
                        {
                          id: "message",
                          label: "Написать сообщение",
                          hint: "Сообщения пока недоступны",
                          icon: MessageSquare,
                          disabled: true,
                        },
                        {
                          id: "archive",
                          label: "Убрать из списка",
                          icon: Archive,
                          destructive: true,
                          separatorBefore: true,
                          disabled,
                          onSelect: () => onArchive(entry.profile),
                        },
                      ];

              return (
                <ProductTableRow
                  key={stableEntryKey(entry)}
                  className={
                    canOpen ? "student-directory-clickable-row" : undefined
                  }
                  onClick={() => {
                    if (!disabled && canOpen && entry.kind === "profile") {
                      onOpen(entry.profile, "profile");
                    }
                  }}
                >
                  <ProductTablePrimaryCell className="overflow-hidden">
                    {canOpen && entry.kind === "profile" ? (
                      <button
                        type="button"
                        className="student-directory-person student-directory-row-trigger"
                        disabled={disabled}
                        aria-label={`Профиль ученика ${displayName}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(entry.profile, "profile");
                        }}
                      >
                        <span
                          className="teaching-learner-avatar"
                          aria-hidden="true"
                        >
                          {initials(displayName)}
                        </span>
                        <strong title={displayName}>{displayName}</strong>
                      </button>
                    ) : (
                      <span className="student-directory-person">
                        <span
                          className="teaching-learner-avatar"
                          aria-hidden="true"
                        >
                          {initials(displayName)}
                        </span>
                        <strong title={displayName}>{displayName}</strong>
                      </span>
                    )}
                  </ProductTablePrimaryCell>
                  <ProductTableCell>
                    <StatusText entry={entry} />
                  </ProductTableCell>
                  <ProductTableCell className="overflow-hidden">
                    <span
                      className="student-directory-plain-text"
                      title={learnerDirectoryAccountLabel(entry)}
                    >
                      {learnerDirectoryAccountLabel(entry)}
                    </span>
                  </ProductTableCell>
                  <ProductTableCell className="overflow-hidden">
                    <span
                      className="student-directory-plain-text"
                      title={fullGroupText}
                      aria-label={fullGroupText}
                    >
                      {groupText}
                    </span>
                  </ProductTableCell>
                  <ProductTableCell className="overflow-hidden">
                    <time
                      className="student-directory-plain-text"
                      dateTime={learnerDirectoryCreatedAt(entry)}
                      title={fullDateFormatter.format(
                        new Date(learnerDirectoryCreatedAt(entry)),
                      )}
                    >
                      {formatCompactDate(learnerDirectoryCreatedAt(entry))}
                    </time>
                  </ProductTableCell>
                  <ProductTableActionCell
                    className="student-directory-action-cell text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="student-directory-actions">
                      <ActionMenu
                        className="student-directory-action-menu"
                        label={`Действия с учеником «${displayName}»`}
                        items={actionItems}
                        triggerIcon={MoreVertical}
                        triggerVariant="ghost"
                        disabled={disabled}
                        portal
                      />
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

export function LearnerGroupsDirectoryTable({
  groups,
  sort,
  onSort,
  hasFilters,
  disabled,
  onOpen,
}: {
  groups: LearnerGroup[];
  sort: ProductTableSortState<LearnerGroupDirectorySortKey>;
  onSort: (key: LearnerGroupDirectorySortKey) => void;
  hasFilters: boolean;
  disabled: boolean;
  onOpen: (group: LearnerGroup) => void;
}) {
  const orderedGroups = sortLearnerGroupsDirectory(groups, sort);

  return (
    <div className="product-table-wrap student-directory-table-wrap">
      <ProductTable className="student-directory-table student-directory-groups-table">
        <caption className="sr-only">Группы учеников</caption>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableSortableHeaderCell
              className="w-[42%]"
              direction={sort.key === "name" ? sort.direction : null}
              onSort={() => onSort("name")}
            >
              Группа
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "members" ? sort.direction : null}
              onSort={() => onSort("members")}
            >
              Ученики
            </ProductTableSortableHeaderCell>
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {orderedGroups.length === 0 ? (
            <EmptyTableRow
              message={hasFilters ? "Ничего не найдено" : "Групп пока нет"}
              colSpan={2}
            />
          ) : (
            orderedGroups.map((group) => {
              const members = [...group.members].sort((left, right) =>
                directoryCollator.compare(left.displayName, right.displayName),
              );
              const preview = members
                .slice(0, 4)
                .map((member) => member.displayName)
                .join(", ");
              const memberText =
                members.length === 0
                  ? "Нет учеников"
                  : `${learnerCountLabel(members.length)} · ${preview}${
                      members.length > 4 ? ` и ещё ${members.length - 4}` : ""
                    }`;
              return (
                <ProductTableRow
                  key={group.id}
                  className="student-directory-clickable-row"
                  onClick={() => {
                    if (!disabled) onOpen(group);
                  }}
                >
                  <ProductTablePrimaryCell className="overflow-hidden">
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
                      <strong title={group.name}>{group.name}</strong>
                    </button>
                  </ProductTablePrimaryCell>
                  <ProductTableCell className="overflow-hidden">
                    <span
                      className="student-directory-plain-text"
                      title={memberText}
                    >
                      {memberText}
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
