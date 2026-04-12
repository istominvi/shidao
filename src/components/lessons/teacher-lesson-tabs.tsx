"use client";

import type { LucideIcon } from "lucide-react";
import { BookOpenText, ClipboardCheck, MessageCircle, NotebookText, PlayCircle } from "lucide-react";

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
};

function tabClassName(active: boolean) {
  return active
    ? "inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white"
    : "inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900";
}

export function TeacherLessonTabs({ tabs, activeTab, onTabChange }: TeacherLessonTabsProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const meta = teacherLessonTabMeta[tab];
          const Icon = meta.icon;
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              className={tabClassName(isActive)}
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
