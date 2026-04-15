"use client";

import type { LucideIcon } from "lucide-react";
import { BookOpenText, ClipboardCheck, MessageCircle, NotebookText, PlayCircle } from "lucide-react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";

export type TeacherLessonTabKey = "plan" | "content" | "homework" | "conduct" | "chat";

export const teacherLessonTabMeta: Record<TeacherLessonTabKey, { label: string; icon: LucideIcon }> = {
  plan: { label: "План урока", icon: NotebookText },
  content: { label: "Контент", icon: BookOpenText },
  homework: { label: "Домашнее задание", icon: ClipboardCheck },
  conduct: { label: "Проведение занятия", icon: PlayCircle },
  chat: { label: "Чат", icon: MessageCircle },
};

type TeacherLessonTabsProps = {
  tabs: TeacherLessonTabKey[];
  activeTab: TeacherLessonTabKey;
  onTabChange: (tab: TeacherLessonTabKey) => void;
  tone?: "surface" | "embedded";
};

function tabClassName(active: boolean, tone: "surface" | "embedded") {
  if (tone === "embedded") {
    return classNames(
      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
      active
        ? "border-neutral-900 bg-neutral-900 text-white shadow-[0_10px_24px_rgba(15,23,42,0.28)]"
        : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100",
    );
  }

  return productButtonClassName(active ? "primary" : "secondary", "text-sm");
}

export function TeacherLessonTabs({ tabs, activeTab, onTabChange, tone = "surface" }: TeacherLessonTabsProps) {
  return (
    <div
      className={classNames(
        "border-neutral-200",
        tone === "surface" ? "rounded-2xl border bg-white p-3" : "border-b pb-4",
      )}
    >
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const meta = teacherLessonTabMeta[tab];
          const Icon = meta.icon;
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              className={tabClassName(isActive, tone)}
              onClick={() => onTabChange(tab)}
              aria-pressed={isActive}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
