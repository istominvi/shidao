"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSystemAssistantPageContext } from "@/components/assistant/system-assistant-provider";
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
  initialCatalogCourseId?: string | null;
  initialLearningAudience?: CourseLearningAudience;
};

const COURSES_INDEX_TABS_ID = "courses-index";
const COURSES_INDEX_TABS = [
  { value: "mine", label: "Мои" },
  { value: "catalog", label: "Каталог" },
] as const satisfies ReadonlyArray<{
  value: CoursesIndexTab;
  label: string;
}>;

export function CoursesIndex({
  initialTab = "mine",
  initialCatalogCourseId = null,
  initialLearningAudience = "children",
}: CoursesIndexProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CoursesIndexTab>(initialTab);
  const [selectedCatalogCourseId, setSelectedCatalogCourseId] = useState<
    string | null
  >(initialCatalogCourseId);
  const [catalogLearningAudience, setCatalogLearningAudience] =
    useState<CourseLearningAudience>(initialLearningAudience);

  useSystemAssistantPageContext({
    surface: "courses",
    view: `courses_${activeTab}`,
    courseId: null,
    lessonId: null,
    label: activeTab === "catalog" ? "Курсы · Каталог" : "Курсы · Мои",
  });

  useEffect(() => {
    setActiveTab(initialTab);
    setSelectedCatalogCourseId(initialCatalogCourseId);
    setCatalogLearningAudience(initialLearningAudience);
  }, [initialCatalogCourseId, initialLearningAudience, initialTab]);

  function catalogQuery({
    courseId,
    learningAudience = catalogLearningAudience,
  }: {
    courseId?: string | null;
    learningAudience?: CourseLearningAudience;
  } = {}) {
    const query = new URLSearchParams({ tab: "catalog" });
    if (learningAudience === "educators") {
      query.set("audience", "educators");
    }
    if (courseId) query.set("course", courseId);
    return query;
  }

  function selectTab(tab: CoursesIndexTab) {
    setActiveTab(tab);
    if (tab === "mine") {
      setSelectedCatalogCourseId(null);
      router.replace("/courses", { scroll: false });
      return;
    }
    const catalogHref =
      catalogLearningAudience === "children"
        ? "/courses?tab=catalog"
        : `/courses?${catalogQuery().toString()}`;
    router.replace(catalogHref, { scroll: false });
  }

  function selectCatalogCourse(courseId: string | null) {
    setSelectedCatalogCourseId(courseId);
    const query = catalogQuery({ courseId });
    const href = `/courses?${query.toString()}`;
    if (courseId) {
      router.push(href, { scroll: false });
      return;
    }
    router.replace(href, { scroll: false });
  }

  function selectCatalogLearningAudience(
    learningAudience: CourseLearningAudience,
  ) {
    setCatalogLearningAudience(learningAudience);
    setSelectedCatalogCourseId(null);
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
                selectedCourseId={selectedCatalogCourseId}
                onSelectCourse={selectCatalogCourse}
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
