import {
  BookOpen,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { InboxItem } from "@/modules/communication/domain";

const sameDayFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});
const recentDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
});
const fullDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function compactCommunicationTime(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (sameLocalDay(date, now)) return sameDayFormatter.format(date);
  if (date.getFullYear() === now.getFullYear()) {
    return recentDateFormatter.format(date);
  }
  return fullDateFormatter.format(date);
}

export function fullCommunicationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function communicationInitials(value: string) {
  return value
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("ru-RU"))
    .join("");
}

export function unreadLabel(value: number) {
  return value > 99 ? "99+" : String(value);
}

export function inboxItemSubtitle(item: InboxItem) {
  switch (item.kind) {
    case "direct":
      return "Личный диалог";
    case "course":
      return "Чат курса";
    case "assistant":
      return "ShiDao ИИ";
    case "system":
      return "Системные уведомления";
  }
}

export function inboxItemIcon(kind: InboxItem["kind"]): LucideIcon {
  switch (kind) {
    case "direct":
      return UserRound;
    case "course":
      return BookOpen;
    case "assistant":
      return Sparkles;
    case "system":
      return ShieldCheck;
  }
}

export function CommunicationAvatar({
  kind,
  title,
}: {
  kind: InboxItem["kind"];
  title: string;
}) {
  const Icon = inboxItemIcon(kind);
  const className =
    kind === "assistant"
      ? "communication-avatar is-assistant"
      : kind === "system"
        ? "communication-avatar is-system"
        : kind === "course"
          ? "communication-avatar is-course"
          : "communication-avatar";

  return (
    <span className={className} aria-hidden="true">
      {kind === "direct" ? (
        communicationInitials(title) || <Icon />
      ) : kind === "system" ? (
        <span className="communication-system-mark">S</span>
      ) : (
        <Icon />
      )}
    </span>
  );
}
