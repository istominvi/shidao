"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, FolderPlus, Search, UserPlus } from "lucide-react";
import { productButtonClassName } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
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
import type { TeacherGroupOperationsRow } from "@/lib/server/teacher-dashboard-operations";
import { ProductTableCard } from "./product-table-card";

type TeacherGroupsCardProps = {
  title?: string;
  actions: Array<{ label: string; href: string }>;
  rows: TeacherGroupOperationsRow[];
  filters: {
    search: string;
    methodology: string;
    methodologyOptions: string[];
  };
  emptyStateText?: string;
};

const ACTION_ICONS = {
  "Добавить группу": FolderPlus,
  "Добавить ученика": UserPlus,
} as const;

export function TeacherGroupsCard({
  title,
  actions,
  rows,
  filters,
  emptyStateText = "По текущим фильтрам групп не найдено.",
}: TeacherGroupsCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  const groupNextLessonLabel = (group: TeacherGroupOperationsRow) =>
    group.nextLessonLabel
      ? [group.nextLessonLabel, group.nextLessonTitle].filter(Boolean).join(" • ")
      : "Не запланировано";

  return (
    <ProductTableCard
      title={title}
      controls={(
        <div className="product-control-rail">
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action.label as keyof typeof ACTION_ICONS] ?? FolderPlus;
            return (
              <Link key={action.label} href={action.href} className={productButtonClassName("secondary")}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{action.label}</span>
              </Link>
            );
          })}
          <div className="product-select-wrap">
            <Select
              name="methodology"
              value={filters.methodology}
              onChange={(event) => setParam("methodology", event.target.value)}
            >
              <option value="">Все методики</option>
              {filters.methodologyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <ChevronDown className="product-select-icon h-4 w-4" aria-hidden="true" />
          </div>
          <div className="product-search-wrap">
            <Search className="product-search-icon h-4 w-4" aria-hidden="true" />
            <Input
              name="q"
              defaultValue={filters.search}
              placeholder="Поиск группы"
              className="product-control-search"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setParam("q", (event.target as HTMLInputElement).value.trim());
                }
              }}
              onBlur={(event) => setParam("q", event.target.value.trim())}
            />
          </div>
        </div>
      )}
    >
      <ul className="mt-2 space-y-2 md:hidden">
        {rows.map((group) => (
          <li key={group.id}>
            <Link
              href={group.groupHref}
              className="block rounded-2xl border border-neutral-200 bg-white p-3 transition hover:border-sky-300"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-neutral-900">{group.groupLabel}</p>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                  {group.studentCount} учен.
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                  {group.progressLabel}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-neutral-600">
                Методика: {group.methodologyLabel ?? "Не назначена"}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Следующее занятие: {groupNextLessonLabel(group)}
              </p>
              <p className="mt-2 text-xs font-semibold text-sky-700">Открыть группу</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <ProductTable>
          <ProductTableHead>
            <ProductTableHeaderRow>
              <ProductTableHeaderCell>Группа</ProductTableHeaderCell>
              <ProductTableHeaderCell>Методика</ProductTableHeaderCell>
              <ProductTableHeaderCell>Ученики</ProductTableHeaderCell>
              <ProductTableHeaderCell>Прогресс</ProductTableHeaderCell>
              <ProductTableHeaderCell>Следующее занятие</ProductTableHeaderCell>
            </ProductTableHeaderRow>
          </ProductTableHead>
          <ProductTableBody>
            {rows.map((group) => (
              <ProductTableRow
                key={group.id}
                className="cursor-pointer"
                onClick={() => router.push(group.groupHref)}
              >
                <ProductTablePrimaryCell className="max-w-0">
                  <ProductTableTruncate title={group.groupLabel}>{group.groupLabel}</ProductTableTruncate>
                </ProductTablePrimaryCell>
                <ProductTableCell className="max-w-0">
                  <ProductTableTruncate title={group.methodologyLabel ?? "Не назначена"}>
                    {group.methodologyLabel ?? "Не назначена"}
                  </ProductTableTruncate>
                </ProductTableCell>
                <ProductTableCell>{group.studentCount}</ProductTableCell>
                <ProductTableCell className="max-w-0">
                  <ProductTableTruncate title={group.progressLabel}>{group.progressLabel}</ProductTableTruncate>
                </ProductTableCell>
                <ProductTableCell className="max-w-0">
                  <ProductTableTruncate title={groupNextLessonLabel(group)}>
                    {groupNextLessonLabel(group)}
                  </ProductTableTruncate>
                </ProductTableCell>
              </ProductTableRow>
            ))}
          </ProductTableBody>
        </ProductTable>
      </div>
      {rows.length === 0 ? <ProductTableEmptyState text={emptyStateText} /> : null}
    </ProductTableCard>
  );
}
