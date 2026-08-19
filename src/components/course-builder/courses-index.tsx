"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Library, type LucideIcon } from "lucide-react";
import { useRegisterAssistantPageContext } from "@/components/communication/assistant-page-context";
import { usePageTransition } from "@/components/navigation/page-transition-provider";
import { CourseCatalogPanel } from "@/components/course-builder/course-catalog-panel";
import { OwnedCoursesPanel } from "@/components/course-builder/owned-courses-panel";
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import type { CourseLearningAudience } from "@/modules/course-builder/learning-audience";

type CoursesIndexTab = "mine" | "catalog";

type CoursesIndexProps = {
  initialTab?: CoursesIndexTab;
  initialLearningAudience?: CourseLearningAudience;
};

const COURSES_INDEX_TABS_ID = "courses-index";
const COURSES_INDEX_TABS = [
  { value: "mine", label: "Мои", icon: BookOpen },
  { value: "catalog", label: "Каталог", icon: Library },
] as const satisfies ReadonlyArray<{
  value: CoursesIndexTab;
  label: string;
  icon: LucideIcon;
}>;

export function CoursesIndex({
  initialTab = "mine",
  initialLearningAudience = "children",
}: CoursesIndexProps) {
  const router = useRouter();
  const pageTransition = usePageTransition();
  const [activeTab, setActiveTab] = useState<CoursesIndexTab>(initialTab);
  const [catalogLearningAudience, setCatalogLearningAudience] =
    useState<CourseLearningAudience>(initialLearningAudience);

  useRegisterAssistantPageContext({
    surface: "courses",
    view: `courses_${activeTab}`,
    courseId: null,
    lessonId: null,
    label: activeTab === "catalog" ? "Курсы · Каталог" : "Курсы · Мои",
  });

  useEffect(() => {
    setActiveTab(initialTab);
    setCatalogLearningAudience(initialLearningAudience);
  }, [initialLearningAudience, initialTab]);

  function catalogQuery({
    learningAudience = catalogLearningAudience,
  }: {
    learningAudience?: CourseLearningAudience;
  } = {}) {
    const query = new URLSearchParams({ tab: "catalog" });
    if (learningAudience === "educators") {
      query.set("audience", "educators");
    }
    return query;
  }

  function selectTab(tab: CoursesIndexTab) {
    setActiveTab(tab);
    if (tab === "mine") {
      router.replace("/courses", { scroll: false });
      return;
    }
    const catalogHref =
      catalogLearningAudience === "children"
        ? "/courses?tab=catalog"
        : `/courses?${catalogQuery().toString()}`;
    router.replace(catalogHref, { scroll: false });
  }

  function openCatalogCourse(courseId: string) {
    const query =
      catalogLearningAudience === "educators" ? "?audience=educators" : "";
    const href = `/courses/catalog/${encodeURIComponent(courseId)}${query}`;
    if (pageTransition) {
      pageTransition.navigate(href, { direction: "forward", scroll: false });
    } else {
      router.push(href, { scroll: false });
    }
  }

  function selectCatalogLearningAudience(
    learningAudience: CourseLearningAudience,
  ) {
    setCatalogLearningAudience(learningAudience);
    router.replace(
      `/courses?${catalogQuery({ learningAudience }).toString()}`,
      { scroll: false },
    );
  }

  return (
    <section className="courses-index-shell">
      <WorkspaceTabs
        idBase={COURSES_INDEX_TABS_ID}
        ariaLabel="Разделы курсов"
        value={activeTab}
        items={COURSES_INDEX_TABS}
        onChange={selectTab}
      />

      {COURSES_INDEX_TABS.map((item) => {
        const active = activeTab === item.value;

        return (
          <div
            key={item.value}
            id={workspaceTabPanelId(COURSES_INDEX_TABS_ID, item.value)}
            role="tabpanel"
            aria-labelledby={workspaceTabId(COURSES_INDEX_TABS_ID, item.value)}
            hidden={!active}
            tabIndex={0}
          >
            {item.value === "mine" ? (
              <OwnedCoursesPanel onOpenCatalog={() => selectTab("catalog")} />
            ) : (
              <CourseCatalogPanel
                active={active}
                onOpenCourse={openCatalogCourse}
                learningAudience={catalogLearningAudience}
                onLearningAudienceChange={selectCatalogLearningAudience}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}
