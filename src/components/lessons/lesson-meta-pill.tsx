import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Layers3,
  Monitor,
  PlayCircle,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Chip, type ChipSize, type ChipTone } from "@/components/ui/chip";

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
  | "methodology"
  | "teacher";

export const lessonMetaIconMap: Record<LessonMetaIconKey, LucideIcon> = {
  group: Users,
  datetime: CalendarClock,
  format: Monitor,
  status: PlayCircle,
  position: Layers3,
  duration: Clock3,
  readiness: CheckCircle2,
  methodology: BookOpen,
  teacher: UserRound,
};

const lessonMetaToneMap: Record<LessonMetaTone, ChipTone> = {
  primary: "sky",
  info: "indigo",
  success: "emerald",
  warning: "amber",
  neutral: "neutral",
  muted: "slate",
};

const lessonMetaToneByIcon: Partial<Record<LessonMetaIconKey, LessonMetaTone>> = {
  status: "info",
  datetime: "primary",
  teacher: "success",
  group: "primary",
  format: "warning",
  methodology: "muted",
};

export function LessonMetaRail({ children }: { children: ReactNode }) {
  return <div className="lesson-meta-rail">{children}</div>;
}

export function LessonMetaPill({
  label,
  tone,
  icon,
  size = "md",
}: {
  label: ReactNode;
  tone?: LessonMetaTone;
  icon?: LessonMetaIconKey;
  size?: ChipSize;
}) {
  const resolvedTone =
    tone ?? (icon ? lessonMetaToneByIcon[icon] : undefined) ?? "neutral";
  return (
    <Chip
      tone={lessonMetaToneMap[resolvedTone]}
      size={size}
      icon={icon ? lessonMetaIconMap[icon] : undefined}
    >
      {label}
    </Chip>
  );
}
