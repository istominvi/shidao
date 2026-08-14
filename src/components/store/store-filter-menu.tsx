"use client";

import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import type { StoreFilters } from "@/components/store/store-catalog";

type StoreFilterMenuProps = {
  filters: Pick<StoreFilters, "audience" | "price" | "availability">;
  onChange: <TKey extends "audience" | "price" | "availability">(
    key: TKey,
    value: StoreFilters[TKey],
  ) => void;
};

export function StoreFilterMenu({ filters, onChange }: StoreFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const generatedId = useId();
  const panelId = `store-filter-panel-${generatedId.replaceAll(":", "")}`;
  const activeCount =
    Number(filters.audience !== "all") +
    Number(filters.price !== "all") +
    Number(filters.availability !== "all");

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!detailsRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function resetFilters() {
    onChange("audience", "all");
    onChange("price", "all");
    onChange("availability", "all");
  }

  return (
    <details
      ref={detailsRef}
      className="course-filter-menu store-filter-menu"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        ref={summaryRef}
        className={productButtonClassName("secondary", "course-filter-trigger")}
        aria-controls={panelId}
        aria-expanded={open}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        <span>Фильтры</span>
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
        aria-label="Фильтры товаров"
      >
        <label className="course-filter-field">
          <span>Для кого</span>
          <span className="product-select-wrap block min-w-0">
            <Select
              value={filters.audience}
              onChange={(event) =>
                onChange(
                  "audience",
                  event.target.value as StoreFilters["audience"],
                )
              }
            >
              <option value="all">Для всех</option>
              <option value="learner">Для ученика</option>
              <option value="teacher">Для преподавателя</option>
            </Select>
            <ChevronDown
              className="product-select-icon h-4 w-4"
              aria-hidden="true"
            />
          </span>
        </label>

        <label className="course-filter-field">
          <span>Цена</span>
          <span className="product-select-wrap block min-w-0">
            <Select
              value={filters.price}
              onChange={(event) =>
                onChange("price", event.target.value as StoreFilters["price"])
              }
            >
              <option value="all">Любая цена</option>
              <option value="under-500">До 500 ₽</option>
              <option value="500-1000">От 500 до 1 000 ₽</option>
              <option value="over-1000">Больше 1 000 ₽</option>
            </Select>
            <ChevronDown
              className="product-select-icon h-4 w-4"
              aria-hidden="true"
            />
          </span>
        </label>

        <label className="course-filter-field">
          <span>Наличие</span>
          <span className="product-select-wrap block min-w-0">
            <Select
              value={filters.availability}
              onChange={(event) =>
                onChange(
                  "availability",
                  event.target.value as StoreFilters["availability"],
                )
              }
            >
              <option value="all">Все товары</option>
              <option value="in-stock">Только в наличии</option>
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
            disabled={activeCount === 0}
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
