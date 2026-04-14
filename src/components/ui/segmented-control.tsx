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
  size?: "sm" | "md";
  fullWidth?: boolean;
  className?: string;
  itemClassName?: string;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  size = "md",
  fullWidth = false,
  className,
  itemClassName,
}: SegmentedControlProps<T>) {
  const containerHeightClass = size === "sm" ? "h-10" : "h-12";
  const itemHeightClass = size === "sm" ? "h-8 text-sm" : "h-10 text-xs";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={classNames(
        "inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 p-1",
        containerHeightClass,
        fullWidth ? "w-full" : undefined,
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
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 font-semibold transition",
              itemHeightClass,
              fullWidth ? "flex-1 justify-center" : undefined,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50",
              isSelected ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-800",
              isDisabled ? "cursor-not-allowed opacity-60" : undefined,
              itemClassName,
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
