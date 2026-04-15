"use client";

import { useState } from "react";
import { MethodologyDescriptionPanel } from "@/components/methodologies/methodology-description-panel";
import { MethodologyLessonsTableCard } from "@/components/methodologies/methodology-lessons-table-card";
import {
  TeacherMethodologyTabs,
  type TeacherMethodologyTabKey,
} from "@/components/methodologies/teacher-methodology-tabs";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { MethodologyProgramDescription } from "@/lib/lesson-content/contracts";

type MethodologyLessonRow = {
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

type MethodologyOverview = {
  passport: {
    audienceLabel?: string;
    targetAgeLabel?: string;
    level?: string;
    lessonDurationLabel?: string;
    courseDurationLabel?: string;
    courseScopeLabel?: string;
    idealGroupSizeLabel?: string;
    maxGroupSize?: number;
    activitiesPerLessonLabel?: string;
    lessonFormatSummary?: string;
  };
  teachingApproachSummary?: string;
  learningOutcomes: string[];
  thematicModules: string[];
  methodologyNotes: string[];
  materialsEcosystemSummary?: string;
};

export function TeacherMethodologyWorkspace({
  methodologySlug,
  lessons,
  overview,
  programDescription,
}: {
  methodologySlug: string;
  lessons: MethodologyLessonRow[];
  overview: MethodologyOverview;
  programDescription: MethodologyProgramDescription | null;
}) {
  const [tab, setTab] = useState<TeacherMethodologyTabKey>("description");

  return (
    <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
      <TeacherMethodologyTabs activeTab={tab} onTabChange={setTab} tone="embedded" />

      <div className="mt-5">
        {tab === "description" ? (
          <section id="methodology-panel-description" role="tabpanel" aria-labelledby="methodology-tab-description">
            <MethodologyDescriptionPanel overview={overview} programDescription={programDescription} />
          </section>
        ) : null}
        {tab === "lessons" ? (
          <section id="methodology-panel-lessons" role="tabpanel" aria-labelledby="methodology-tab-lessons">
            <MethodologyLessonsTableCard
              methodologySlug={methodologySlug}
              rows={lessons}
              embedded
            />
          </section>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
