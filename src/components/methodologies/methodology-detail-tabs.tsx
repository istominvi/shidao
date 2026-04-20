"use client";

import { BookOpenText, NotebookText, type LucideIcon } from "lucide-react";
import { productButtonClassName } from "@/components/ui/button";
import { classNames } from "@/lib/ui/classnames";

export type MethodologyDetailTabKey = "description" | "lessons";

const methodologyDetailTabMeta: Record<
  MethodologyDetailTabKey,
  { label: string; icon: LucideIcon }
> = {
  description: { label: "Описание", icon: NotebookText },
  lessons: { label: "Уроки", icon: BookOpenText },
};

type MethodologyDetailTabsProps = {
  activeTab: MethodologyDetailTabKey;
  onTabChange: (tab: MethodologyDetailTabKey) => void;
};

function embeddedTabClassName(active: boolean) {
  return classNames(
    productButtonClassName("secondary", "text-sm"),
    active &&
      "!border-neutral-900 !bg-neutral-900 !text-white shadow-[0_10px_20px_rgba(15,23,42,0.08)] hover:!border-neutral-900 hover:!bg-neutral-900 hover:!text-white",
  );
}

export function MethodologyDetailTabs({
  activeTab,
  onTabChange,
}: MethodologyDetailTabsProps) {
  return (
    <div className="-mx-5 md:-mx-6">
      <div className="px-5 md:px-6">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(methodologyDetailTabMeta) as MethodologyDetailTabKey[]).map(
            (tab) => {
              const meta = methodologyDetailTabMeta[tab];
              const Icon = meta.icon;
              const isActive = tab === activeTab;

              return (
                <button
                  key={tab}
                  type="button"
                  className={embeddedTabClassName(isActive)}
                  onClick={() => onTabChange(tab)}
                  aria-pressed={isActive}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{meta.label}</span>
                </button>
              );
            },
          )}
        </div>
      </div>
      <div className="mt-5 border-b border-neutral-200" />
    </div>
  );
}
