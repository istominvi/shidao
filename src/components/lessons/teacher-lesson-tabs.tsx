"use client";

import type { LucideIcon } from "lucide-react";
import { BookOpenText, ClipboardCheck, MessageCircle, NotebookText } from "lucide-react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";

export type TeacherLessonTabKey = "plan" | "student_screen" | "homework" | "chat";

export const teacherLessonTabMeta: Record<TeacherLessonTabKey, { label: string; icon: LucideIcon }> = {
  plan: { label: "План урока", icon: NotebookText },
  student_screen: { label: "Экран ученика", icon: BookOpenText },
  homework: { label: "Домашнее задание", icon: ClipboardCheck },
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
      productButtonClassName("secondary", "text-sm"),
      active && "!border-neutral-900 !bg-neutral-900 !text-white shadow-[0_10px_20px_rgba(15,23,42,0.08)] hover:!border-neutral-900 hover:!bg-neutral-900 hover:!text-white",
    );
  }

  return productButtonClassName(active ? "primary" : "secondary", "text-sm");
}

export function TeacherLessonTabs({ tabs, activeTab, onTabChange, tone = "surface" }: TeacherLessonTabsProps) {
  if (tone === "embedded") {
    return (
      <div className="-mx-5 md:-mx-6">
        <div className="px-5 md:px-6">
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
        <div className="mt-5 border-b border-neutral-200" />
      </div>
    );
  }

  return (
    <div
      className={classNames(
        "border-neutral-200",
        "rounded-2xl border bg-white p-3",
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
