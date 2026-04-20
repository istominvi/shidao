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
      <div className="space-y-3 md:hidden">
        {rows.map((group) => (
          <Link
            key={group.id}
            href={group.groupHref}
            className="block rounded-2xl border border-black/10 bg-white/90 p-4 shadow-[0_8px_24px_rgba(20,20,20,0.04)] transition hover:border-black/15 hover:bg-white"
          >
            <p className="truncate text-base font-semibold text-neutral-900" title={group.groupLabel}>
              {group.groupLabel}
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-neutral-500">Методика</dt>
                <dd className="text-right font-medium text-neutral-900">
                  {group.methodologyLabel ?? "Не назначена"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-neutral-500">Ученики</dt>
                <dd className="font-medium text-neutral-900">{group.studentCount}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-neutral-500">Прогресс</dt>
                <dd className="text-right font-medium text-neutral-900">{group.progressLabel}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-neutral-500">Следующее занятие</dt>
                <dd className="max-w-[68%] text-right font-medium text-neutral-900" title={groupNextLessonLabel(group)}>
                  {groupNextLessonLabel(group)}
                </dd>
              </div>
            </dl>
          </Link>
        ))}
      </div>

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
