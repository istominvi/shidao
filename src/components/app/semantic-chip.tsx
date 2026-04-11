import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type SemanticTone = "neutral" | "sky" | "violet" | "emerald" | "amber" | "rose" | "indigo";

type SemanticChipProps = {
  icon: LucideIcon;
  children: ReactNode;
  tone?: SemanticTone;
  size?: "sm" | "md";
  className?: string;
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const toneClass: Record<SemanticTone, string> = {
  neutral: "border-neutral-200 bg-white/95 text-neutral-700",
  sky: "border-sky-200 bg-sky-50/90 text-sky-800",
  violet: "border-violet-200 bg-violet-50/90 text-violet-800",
  emerald: "border-emerald-200 bg-emerald-50/90 text-emerald-800",
  amber: "border-amber-200 bg-amber-50/90 text-amber-800",
  rose: "border-rose-200 bg-rose-50/90 text-rose-800",
  indigo: "border-indigo-200 bg-indigo-50/90 text-indigo-800",
};

const sizeClass = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
} as const;

export function SemanticChip({ icon: Icon, children, tone = "neutral", size = "sm", className }: SemanticChipProps) {
  return (
    <span className={joinClasses("landing-chip border", toneClass[tone], sizeClass[size], className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
