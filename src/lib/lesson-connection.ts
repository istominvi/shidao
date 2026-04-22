import type { ScheduledLessonRuntimeShell } from "@/lib/lesson-content";

export type LessonConnectionInfo =
  | {
      kind: "online";
      formatLabel: "Онлайн";
      title: "Онлайн-занятие";
      meetingLink?: string;
      ctaLabel: string | null;
      displayLabel: string;
    }
  | {
      kind: "offline";
      formatLabel: "Офлайн";
      title: "Место проведения";
      place: string;
      ctaLabel: null;
      displayLabel: string;
    };

function parseHostname(link: string) {
  try {
    return new URL(link).hostname;
  } catch {
    return "";
  }
}

export function buildLessonConnectionInfo(
  runtimeShell: ScheduledLessonRuntimeShell,
  labels: { onlineCtaLabel: string; onlineDisplayLabel?: string; offlineDisplayPrefix?: string },
): LessonConnectionInfo {
  if (runtimeShell.format === "online") {
    const meetingLink = runtimeShell.meetingLink?.trim() || "";
    const hostname = parseHostname(meetingLink);
    return {
      kind: "online",
      formatLabel: "Онлайн",
      title: "Онлайн-занятие",
      meetingLink: meetingLink || undefined,
      ctaLabel: meetingLink ? labels.onlineCtaLabel : null,
      displayLabel:
        hostname || labels.onlineDisplayLabel || "Ссылка не указана",
    };
  }

  return {
    kind: "offline",
    formatLabel: "Офлайн",
    title: "Место проведения",
    place: runtimeShell.place,
    ctaLabel: null,
    displayLabel: labels.offlineDisplayPrefix
      ? `${labels.offlineDisplayPrefix}${runtimeShell.place}`
      : runtimeShell.place,
  };
}
