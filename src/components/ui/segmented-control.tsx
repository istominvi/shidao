import type { LucideIcon } from "lucide-react";
import { classNames } from "@/lib/ui/classnames";

type SegmentedControlItem<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  busy?: boolean;
};

type SegmentedControlProps<T extends string> = {
  items: SegmentedControlItem<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={classNames(
        "inline-flex h-10 items-center rounded-[0.95rem] border border-neutral-200 bg-neutral-100 p-0",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isSelected = item.value === value;
        const isDisabled = disabled || item.disabled;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={isSelected}
            disabled={isDisabled}
            onClick={() => onChange(item.value)}
            aria-busy={item.busy || undefined}
            className={classNames(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[0.95rem] px-3 text-[0.9rem] font-semibold leading-none transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50",
              isSelected ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-800",
              isDisabled ? "cursor-not-allowed opacity-60" : undefined,
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
