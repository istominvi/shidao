"use client";

import { useState } from "react";
import { MethodologyDescriptionPanel } from "@/components/methodologies/methodology-description-panel";
import { MethodologyDetailTabs, type MethodologyDetailTabKey } from "@/components/methodologies/methodology-detail-tabs";
import { MethodologyLessonsTableCard } from "@/components/methodologies/methodology-lessons-table-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { MethodologyDescriptionContent } from "@/lib/methodologies/description-content";

type MethodologyDetailWorkspaceProps = {
  methodology: {
    slug: string;
    title: string;
    shortDescription: string | null | undefined;
    coverImage: { src: string; alt: string } | null;
  };
  descriptionContent: MethodologyDescriptionContent | null;
  lessons: Array<{
    id: string;
    title: string;
    durationLabel: string;
    nearestAssignedAtLabel: string | null;
    mediaSummary: {
      videos: number;
      songs: number;
      worksheets: number;
      other: number;
    };
    materialsSignal: boolean;
    homeworkSignal: boolean;
  }>;
};

export function MethodologyDetailWorkspace({
  methodology,
  descriptionContent,
  lessons,
}: MethodologyDetailWorkspaceProps) {
  const [tab, setTab] = useState<MethodologyDetailTabKey>("description");

  return (
    <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
      <MethodologyDetailTabs activeTab={tab} onTabChange={setTab} />

      <div className="mt-5">
        <div id="methodology-panel-description" role="tabpanel" aria-labelledby="methodology-tab-description" hidden={tab !== "description"}>
          {descriptionContent ? (
            <MethodologyDescriptionPanel
              title={methodology.title}
              shortDescription={methodology.shortDescription}
              coverImage={methodology.coverImage}
              content={descriptionContent}
            />
          ) : (
            <section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 text-sm text-neutral-700">
              Подробное описание для этой методики будет добавлено позже.
            </section>
          )}
        </div>

        <div id="methodology-panel-lessons" role="tabpanel" aria-labelledby="methodology-tab-lessons" hidden={tab !== "lessons"}>
          <MethodologyLessonsTableCard methodologySlug={methodology.slug} rows={lessons} />
        </div>
      </div>
    </SurfaceCard>
  );
}
