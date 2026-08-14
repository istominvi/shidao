"use client";

import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { classNames } from "@/lib/ui/classnames";

export type StudentDirectoryStatusFilter =
  "all" | "active" | "pending" | "archived";

/** `all`, `grouped`, `ungrouped` or a concrete learner-group UUID. */
export type StudentDirectoryGroupFilter = string;

export type StudentDirectoryAccountFilter =
  "all" | "connected" | "offline" | "pending";

export type StudentDirectoryFilterGroup = {
  id: string;
  name: string;
};

type StudentDirectoryFilterMenuProps = {
  groups: ReadonlyArray<StudentDirectoryFilterGroup>;
  status: StudentDirectoryStatusFilter;
  group: StudentDirectoryGroupFilter;
  account: StudentDirectoryAccountFilter;
  onStatusChange: (value: StudentDirectoryStatusFilter) => void;
  onGroupChange: (value: StudentDirectoryGroupFilter) => void;
  onAccountChange: (value: StudentDirectoryAccountFilter) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
};

export function StudentDirectoryFilterMenu({
  groups,
  status,
  group,
  account,
  onStatusChange,
  onGroupChange,
  onAccountChange,
  disabled = false,
  className,
  label = "Фильтры учеников",
}: StudentDirectoryFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const generatedId = useId();
  const panelId = `student-directory-filter-panel-${generatedId.replaceAll(":", "")}`;
  const activeCount =
    Number(status !== "all") +
    Number(group !== "all") +
    Number(account !== "all");
  const grouped = group !== "all" && group !== "ungrouped";
  const concreteGroupId =
    group !== "all" && group !== "grouped" && group !== "ungrouped"
      ? group
      : "";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => summaryRef.current?.focus());
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function resetFilters() {
    onStatusChange("all");
    onGroupChange("all");
    onAccountChange("all");
  }

  return (
    <details
      ref={detailsRef}
      className={classNames("course-filter-menu", className)}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        ref={summaryRef}
        className={productButtonClassName("secondary", "course-filter-trigger")}
        aria-controls={panelId}
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        <span>Фильтр</span>
        {activeCount > 0 ? (
          <span
            className="course-filter-count"
            aria-label={`Выбрано: ${activeCount}`}
          >
            {activeCount}
          </span>
        ) : null}
        <ChevronDown
          className="course-filter-chevron h-4 w-4"
          aria-hidden="true"
        />
      </summary>

      <div
        id={panelId}
        className="product-dropdown-surface course-filter-popover"
        role="group"
        aria-label={label}
      >
        <label className="course-filter-field">
          <span>Состояние</span>
          <span className="product-select-wrap block min-w-0">
            <Select
              value={status}
              disabled={disabled}
              onChange={(event) =>
                onStatusChange(
                  event.target.value as StudentDirectoryStatusFilter,
                )
              }
            >
              <option value="all">Все</option>
              <option value="active">Активные</option>
              <option value="pending">Ожидают ответа</option>
              <option value="archived">В архиве</option>
            </Select>
            <ChevronDown
              className="product-select-icon h-4 w-4"
              aria-hidden="true"
            />
          </span>
        </label>

        <div className="course-filter-field">
          <span>Принадлежность к группе</span>
          <div
            className="product-segmented-control grid grid-cols-3 gap-1 rounded-xl p-1"
            role="group"
            aria-label="Принадлежность к группе"
          >
            <button
              type="button"
              className={classNames(
                "product-segmented-control-option min-h-8 rounded-lg px-2 text-xs transition-colors",
                group === "all"
                  ? "product-segmented-control-option-selected bg-white text-neutral-950"
                  : "text-neutral-600 hover:text-neutral-950",
              )}
              aria-pressed={group === "all"}
              disabled={disabled}
              onClick={() => onGroupChange("all")}
            >
              Все
            </button>
            <button
              type="button"
              className={classNames(
                "product-segmented-control-option min-h-8 rounded-lg px-2 text-xs transition-colors",
                grouped
                  ? "product-segmented-control-option-selected bg-white text-neutral-950"
                  : "text-neutral-600 hover:text-neutral-950",
              )}
              aria-pressed={grouped}
              disabled={disabled}
              onClick={() => onGroupChange("grouped")}
            >
              В группе
            </button>
            <button
              type="button"
              className={classNames(
                "product-segmented-control-option min-h-8 rounded-lg px-2 text-xs transition-colors",
                group === "ungrouped"
                  ? "product-segmented-control-option-selected bg-white text-neutral-950"
                  : "text-neutral-600 hover:text-neutral-950",
              )}
              aria-pressed={group === "ungrouped"}
              disabled={disabled}
              onClick={() => onGroupChange("ungrouped")}
            >
              Без группы
            </button>
          </div>
        </div>

        <label className="course-filter-field">
          <span>Конкретная группа</span>
          <span className="product-select-wrap block min-w-0">
            <Select
              value={concreteGroupId}
              disabled={disabled || !grouped}
              onChange={(event) =>
                onGroupChange(event.target.value || "grouped")
              }
            >
              <option value="">Любая группа</option>
              {groups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
            <ChevronDown
              className="product-select-icon h-4 w-4"
              aria-hidden="true"
            />
          </span>
        </label>

        <label className="course-filter-field">
          <span>Аккаунт</span>
          <span className="product-select-wrap block min-w-0">
            <Select
              value={account}
              disabled={disabled}
              onChange={(event) =>
                onAccountChange(
                  event.target.value as StudentDirectoryAccountFilter,
                )
              }
            >
              <option value="all">Любой</option>
              <option value="connected">Подключён</option>
              <option value="offline">Без аккаунта</option>
              <option value="pending">Ожидает подключения</option>
            </Select>
            <ChevronDown
              className="product-select-icon h-4 w-4"
              aria-hidden="true"
            />
          </span>
        </label>

        <div className="course-filter-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={disabled || activeCount === 0}
            onClick={resetFilters}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Сбросить фильтры
          </Button>
        </div>
      </div>
    </details>
  );
}
