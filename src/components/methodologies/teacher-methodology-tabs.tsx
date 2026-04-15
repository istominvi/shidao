"use client";

import type { LucideIcon } from "lucide-react";
import { BookText, TableProperties } from "lucide-react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";

export type TeacherMethodologyTabKey = "description" | "lessons";

const methodologyTabMeta: Record<TeacherMethodologyTabKey, { label: string; icon: LucideIcon }> = {
  description: { label: "Описание", icon: BookText },
  lessons: { label: "Уроки", icon: TableProperties },
};

type TeacherMethodologyTabsProps = {
  activeTab: TeacherMethodologyTabKey;
  onTabChange: (tab: TeacherMethodologyTabKey) => void;
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

export function TeacherMethodologyTabs({
  activeTab,
  onTabChange,
  tone = "surface",
}: TeacherMethodologyTabsProps) {
  const tabs: TeacherMethodologyTabKey[] = ["description", "lessons"];

  return (
    <div
      className={classNames(
        "border-neutral-200",
        tone === "surface" ? "rounded-2xl border bg-white p-3" : "border-b pb-4",
      )}
    >
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Разделы методики">
        {tabs.map((tab) => {
          const meta = methodologyTabMeta[tab];
          const Icon = meta.icon;
          const isActive = tab === activeTab;

          return (
            <button
              key={tab}
              id={`methodology-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`methodology-panel-${tab}`}
              tabIndex={isActive ? 0 : -1}
              className={tabClassName(isActive, tone)}
              onClick={() => onTabChange(tab)}
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
