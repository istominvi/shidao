import { BookOpen, CalendarClock } from "lucide-react";
import type { ReactNode } from "react";
import { Chip } from "@/components/ui/chip";

type LessonContextChipProps = {
  context: "methodology" | "schedule";
  children?: ReactNode;
};

export function LessonContextChip({ context, children }: LessonContextChipProps) {
  if (context === "methodology") {
    return (
      <Chip tone="violet" icon={BookOpen}>
        {children ?? "Source-урок методики"}
      </Chip>
    );
  }

  return (
    <Chip tone="sky" icon={CalendarClock}>
      {children ?? "Runtime-урок в расписании"}
    </Chip>
  );
}
