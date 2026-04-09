import { BookOpen, CalendarClock } from "lucide-react";
import type { ReactNode } from "react";

type LessonContextChipProps = {
  context: "methodology" | "schedule";
  children?: ReactNode;
};

export function LessonContextChip({ context, children }: LessonContextChipProps) {
  if (context === "methodology") {
    return (
      <span className="landing-chip rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-800">
        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{children ?? "Source-урок методики"}</span>
      </span>
    );
  }

  return (
    <span className="landing-chip rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{children ?? "Runtime-урок в расписании"}</span>
    </span>
  );
}
