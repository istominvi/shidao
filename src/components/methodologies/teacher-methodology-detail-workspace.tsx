"use client";

import { useState } from "react";
import { MethodologyDescriptionPanel } from "@/components/methodologies/methodology-description-panel";
import {
  MethodologyDetailTabs,
  type MethodologyDetailTabKey,
} from "@/components/methodologies/methodology-detail-tabs";
import { MethodologyLessonsTableCard } from "@/components/methodologies/methodology-lessons-table-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { MethodologyDescriptionContent } from "@/lib/methodologies/methodology-description-content";

type MethodologyLessonsTableRow = {
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
};

export function TeacherMethodologyDetailWorkspace({
  methodologySlug,
  descriptionContent,
  lessons,
}: {
  methodologySlug: string;
  descriptionContent: MethodologyDescriptionContent | null;
  lessons: MethodologyLessonsTableRow[];
}) {
  const [tab, setTab] = useState<MethodologyDetailTabKey>("description");

  return (
    <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
      <MethodologyDetailTabs activeTab={tab} onTabChange={setTab} />

      <div className="mt-5">
        {tab === "description" ? (
          <MethodologyDescriptionPanel description={descriptionContent} />
        ) : null}

        {tab === "lessons" ? (
          <MethodologyLessonsTableCard
            methodologySlug={methodologySlug}
            rows={lessons}
            embedded
          />
        ) : null}
      </div>
    </SurfaceCard>
  );
}
