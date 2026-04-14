import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

export type ChipTone =
  | "neutral"
  | "sky"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "indigo"
  | "slate";

export type ChipSize = "sm" | "md";

type ChipProps = {
  children: ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  icon?: LucideIcon;
  className?: string;
};

const chipToneClass: Record<ChipTone, string> = {
  neutral: "border-neutral-200 bg-white/95 text-neutral-700",
  sky: "border-sky-200 bg-sky-50/90 text-sky-800",
  violet: "border-violet-200 bg-violet-50/90 text-violet-800",
  emerald: "border-emerald-200 bg-emerald-50/90 text-emerald-800",
  amber: "border-amber-200 bg-amber-50/90 text-amber-800",
  rose: "border-rose-200 bg-rose-50/90 text-rose-800",
  indigo: "border-indigo-200 bg-indigo-50/90 text-indigo-800",
  slate: "border-slate-200 bg-slate-50/90 text-slate-700",
};

const chipSizeClass: Record<ChipSize, string> = {
  sm: "gap-1.5 px-2.5 py-1 text-xs",
  md: "gap-2 px-3 py-1.5 text-sm",
};

const chipIconSizeClass: Record<ChipSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

export function Chip({
  children,
  tone = "neutral",
  size = "sm",
  icon: Icon,
  className,
}: ChipProps) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border font-semibold shadow-[0_8px_20px_rgba(20,20,20,0.06),inset_0_1px_0_rgba(255,255,255,0.85)]",
        chipToneClass[tone],
        chipSizeClass[size],
        className,
      )}
    >
      {Icon ? <Icon className={chipIconSizeClass[size]} aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}
