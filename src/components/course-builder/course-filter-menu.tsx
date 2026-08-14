"use client";

import { ChevronDown, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { CourseCatalogFilters } from "@/components/course-builder/course-catalog";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

type CourseFilterMenuProps = {
  subjects: string[];
  levels: string[];
  subject: string;
  level: string;
  onSubjectChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  content?: CourseCatalogFilters["content"];
  onContentChange?: (value: CourseCatalogFilters["content"]) => void;
  disabled?: boolean;
  label?: string;
};

export function CourseFilterMenu({
  subjects,
  levels,
  subject,
  level,
  onSubjectChange,
  onLevelChange,
  content,
  onContentChange,
  disabled = false,
  label = "Фильтры курсов",
}: CourseFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const generatedId = useId();
  const panelId = `course-filter-panel-${generatedId.replaceAll(":", "")}`;
  const hasContentFilter = content !== undefined && Boolean(onContentChange);
  const activeCount =
    Number(subject !== "all") +
    Number(level !== "all") +
    Number(hasContentFilter && content !== "all");

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
    onSubjectChange("all");
    onLevelChange("all");
    if (hasContentFilter) onContentChange?.("all");
  }

  return (
    <details
      ref={detailsRef}
      className="course-filter-menu"
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
        className="course-filter-popover"
        role="group"
        aria-label={label}
      >
        <label className="course-filter-field">
          <span>Предмет</span>
          <span className="product-select-wrap block min-w-0">
            <Select
              value={subject}
              disabled={disabled}
              onChange={(event) => onSubjectChange(event.target.value)}
            >
              <option value="all">Все предметы</option>
              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
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
          <span>Уровень</span>
          <span className="product-select-wrap block min-w-0">
            <Select
              value={level}
              disabled={disabled}
              onChange={(event) => onLevelChange(event.target.value)}
            >
              <option value="all">Все уровни</option>
              {levels.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
            <ChevronDown
              className="product-select-icon h-4 w-4"
              aria-hidden="true"
            />
          </span>
        </label>

        {hasContentFilter ? (
          <label className="course-filter-field">
            <span>Наполнение</span>
            <span className="product-select-wrap block min-w-0">
              <Select
                value={content}
                disabled={disabled}
                onChange={(event) =>
                  onContentChange?.(
                    event.target.value as CourseCatalogFilters["content"],
                  )
                }
              >
                <option value="all">Любое</option>
                <option value="empty">Пустые</option>
                <option value="with-lessons">С уроками</option>
                <option value="assembled">Собранные</option>
              </Select>
              <ChevronDown
                className="product-select-icon h-4 w-4"
                aria-hidden="true"
              />
            </span>
          </label>
        ) : null}

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
