"use client";

import { BookOpenText, Rows4 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";

export type MethodologyDetailTabKey = "description" | "lessons";

const methodologyDetailTabMeta: Record<
  MethodologyDetailTabKey,
  { label: string; icon: typeof BookOpenText }
> = {
  description: { label: "Описание", icon: BookOpenText },
  lessons: { label: "Уроки", icon: Rows4 },
};

function tabClassName(active: boolean) {
  return classNames(
    productButtonClassName("secondary", "text-sm"),
    active &&
      "!border-neutral-900 !bg-neutral-900 !text-white shadow-[0_10px_20px_rgba(15,23,42,0.08)] hover:!border-neutral-900 hover:!bg-neutral-900 hover:!text-white",
  );
}

export function MethodologyDetailTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: MethodologyDetailTabKey;
  onTabChange: (tab: MethodologyDetailTabKey) => void;
}) {
  const tabs: MethodologyDetailTabKey[] = ["description", "lessons"];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();

    if (event.key === "Home") {
      onTabChange(tabs[0]);
      return;
    }
    if (event.key === "End") {
      onTabChange(tabs[tabs.length - 1]);
      return;
    }

    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + offset + tabs.length) % tabs.length;
    onTabChange(tabs[nextIndex]);
  }

  return (
    <div className="border-b border-neutral-200 pb-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Разделы методики">
        {tabs.map((tab, index) => {
          const isActive = tab === activeTab;
          const meta = methodologyDetailTabMeta[tab];
          const Icon = meta.icon;

          return (
            <button
              key={tab}
              id={`methodology-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`methodology-panel-${tab}`}
              tabIndex={isActive ? 0 : -1}
              className={tabClassName(isActive)}
              onClick={() => onTabChange(tab)}
              onKeyDown={(event) => onKeyDown(event, index)}
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
