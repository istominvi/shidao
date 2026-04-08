import type { ReactNode } from "react";

type LessonContextChipProps = {
  context: "methodology" | "schedule";
  children?: ReactNode;
};

export function LessonContextChip({ context, children }: LessonContextChipProps) {
  if (context === "methodology") {
    return (
      <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
        {children ?? "В методике"}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
      {children ?? "В расписании"}
    </span>
  );
}
