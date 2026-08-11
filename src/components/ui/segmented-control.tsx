import type { LucideIcon } from "lucide-react";
import { classNames } from "@/lib/ui/classnames";

type SegmentedControlItem<T extends string> = {
  value: T;
  label: string;
  ariaLabel?: string;
  icon?: LucideIcon;
  count?: number;
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
  iconOnly?: boolean;
};

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className,
  iconOnly = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={classNames(
        "inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-neutral-950/[0.05] p-1 shadow-[inset_0_0_0_1px_rgba(20,20,20,0.1)]",
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
            aria-label={item.ariaLabel ?? (iconOnly ? item.label : undefined)}
            title={iconOnly ? item.label : undefined}
            disabled={isDisabled}
            onClick={() => onChange(item.value)}
            aria-busy={item.busy || undefined}
            className={classNames(
              "inline-flex h-8 min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-[0.88rem] font-medium leading-none transition",
              iconOnly ? "w-8 px-0" : "px-3",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-900/60",
              isSelected
                ? "bg-white text-neutral-950 shadow-[0_1px_3px_rgba(20,20,20,0.1),0_4px_12px_rgba(20,20,20,0.06)]"
                : "text-neutral-600 hover:bg-neutral-950/[0.06] hover:text-neutral-950",
              isDisabled ? "cursor-not-allowed opacity-60" : undefined,
            )}
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
            {!iconOnly ? <span>{item.label}</span> : null}
            {!iconOnly && item.count !== undefined ? (
              <span className="min-w-4 text-center text-[0.68rem] text-neutral-500">
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
