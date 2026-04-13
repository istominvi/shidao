import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Layers3,
  Monitor,
  PlayCircle,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "@/lib/ui/classnames";

export type LessonMetaTone =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "neutral"
  | "muted";
export type LessonMetaIconKey =
  | "group"
  | "datetime"
  | "format"
  | "status"
  | "position"
  | "duration"
  | "readiness"
  | "methodology";

export const lessonMetaIconMap: Record<LessonMetaIconKey, LucideIcon> = {
  group: Users,
  datetime: CalendarClock,
  format: Monitor,
  status: PlayCircle,
  position: Layers3,
  duration: Clock3,
  readiness: CheckCircle2,
  methodology: BookOpen,
};

export function LessonMetaRail({ children }: { children: ReactNode }) {
  return <div className="lesson-meta-rail">{children}</div>;
}

export function LessonMetaPill({
  label,
  tone = "neutral",
  icon,
}: {
  label: ReactNode;
  tone?: LessonMetaTone;
  icon?: LessonMetaIconKey;
}) {
  const Icon = icon ? lessonMetaIconMap[icon] : null;

  return (
    <span
      className={classNames("lesson-meta-pill", `lesson-meta-pill-${tone}`)}
    >
      {Icon ? (
        <Icon className="lesson-meta-pill-icon" aria-hidden="true" />
      ) : null}
      <span>{label}</span>
    </span>
  );
}
