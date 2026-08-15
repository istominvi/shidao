"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";

export type ProductSelectOption<TValue extends string> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};

type ProductSelectProps<TValue extends string> = {
  label: string;
  value: TValue;
  options: ReadonlyArray<ProductSelectOption<TValue>>;
  onChange: (value: TValue) => void;
  disabled?: boolean;
  className?: string;
};

function normalizeTypeahead(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export function ProductSelect<TValue extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className,
}: ProductSelectProps<TValue>) {
  const generatedId = useId().replaceAll(":", "");
  const panelId = `product-select-panel-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<TValue>(value);
  const enabledOptions = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];
  const activeOption =
    enabledOptions.find((option) => option.value === activeValue) ??
    enabledOptions[0];

  useEffect(() => {
    return () => {
      if (typeaheadTimeoutRef.current) {
        clearTimeout(typeaheadTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function openList() {
    if (disabled || enabledOptions.length === 0) return;
    setActiveValue(
      enabledOptions.some((option) => option.value === value)
        ? value
        : enabledOptions[0].value,
    );
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    typeaheadRef.current = "";
  }

  function selectValue(nextValue: TValue) {
    onChange(nextValue);
    setActiveValue(nextValue);
    closeList();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function moveActive(direction: -1 | 1) {
    if (enabledOptions.length === 0) return;
    const currentIndex = enabledOptions.findIndex(
      (option) => option.value === activeValue,
    );
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : enabledOptions.length - 1
        : (currentIndex + direction + enabledOptions.length) %
          enabledOptions.length;
    setActiveValue(enabledOptions[nextIndex].value);
  }

  function handleTypeahead(character: string) {
    const nextQuery = `${typeaheadRef.current}${character}`;
    typeaheadRef.current = nextQuery;
    if (typeaheadTimeoutRef.current) {
      clearTimeout(typeaheadTimeoutRef.current);
    }
    typeaheadTimeoutRef.current = setTimeout(() => {
      typeaheadRef.current = "";
    }, 650);

    const normalizedQuery = normalizeTypeahead(nextQuery);
    const match = enabledOptions.find((option) =>
      normalizeTypeahead(option.label).startsWith(normalizedQuery),
    );
    if (match) setActiveValue(match.value);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeList();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
      } else {
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }

    if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      const option =
        event.key === "Home"
          ? enabledOptions[0]
          : enabledOptions[enabledOptions.length - 1];
      if (option) setActiveValue(option.value);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) openList();
      else if (activeOption) selectValue(activeOption.value);
      return;
    }

    if (event.key === "Tab") {
      closeList();
      return;
    }

    if (
      event.key.length === 1 &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      if (!open) openList();
      handleTypeahead(event.key);
    }
  }

  return (
    <div
      ref={rootRef}
      className={classNames("product-select", className)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closeList();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className={productButtonClassName(
          "secondary",
          "product-select-trigger",
        )}
        aria-label={`${label}: ${selectedOption?.label ?? ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        aria-activedescendant={
          open && activeOption
            ? `product-select-option-${generatedId}-${activeOption.value}`
            : undefined
        }
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="product-select-trigger-label">
          {selectedOption?.label ?? ""}
        </span>
        <ChevronDown
          className="product-select-chevron h-4 w-4"
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={panelId}
          className="product-dropdown-surface product-select-panel"
          role="listbox"
          aria-label={label}
        >
          {options.map((option) => {
            const active = option.value === activeOption?.value;
            const selected = option.value === value;
            return (
              <button
                id={`product-select-option-${generatedId}-${option.value}`}
                key={option.value}
                type="button"
                role="option"
                tabIndex={-1}
                className={classNames(
                  "product-select-option",
                  active && "is-active",
                )}
                aria-selected={selected}
                disabled={option.disabled}
                onPointerDown={(event) => event.preventDefault()}
                onPointerMove={() => {
                  if (!option.disabled) setActiveValue(option.value);
                }}
                onClick={() => {
                  if (!option.disabled) selectValue(option.value);
                }}
              >
                <Check
                  className="product-select-option-check h-4 w-4"
                  aria-hidden="true"
                />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
