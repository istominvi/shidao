"use client";

import { useState } from "react";
import { LessonCanonicalHomeworkPanel } from "@/components/lessons/lesson-canonical-homework-panel";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { TeacherLessonTabs, type TeacherLessonTabKey } from "@/components/lessons/teacher-lesson-tabs";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { MethodologyLessonStudentContent } from "@/lib/lesson-content";
import type { MethodologyLessonUnifiedReadModel } from "@/lib/server/methodology-lesson-unified-read-model";

type MethodologyLessonReadModel = {
  metadata: { durationLabel: string };
  canonicalHomework: {
    title: string;
    kind: "practice_text" | "quiz_single_choice";
    kindLabel: string;
    instructions: string;
    estimatedMinutes: number | null;
    materialLinks: string[];
    answerFormatHint: string | null;
    sourceLayerNote: string;
    quizDefinition: Record<string, unknown> | null;
  } | null;
  studentContent: {
    source: MethodologyLessonStudentContent | null;
    unavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
    assetsById: MethodologyLessonUnifiedReadModel["assetsById"];
  };
  unifiedReadModel: MethodologyLessonUnifiedReadModel;
};

const mainTabs: TeacherLessonTabKey[] = ["plan", "student_screen", "homework"];

export function TeacherMethodologyLessonWorkspace({ readModel }: { readModel: MethodologyLessonReadModel }) {
  const [tab, setTab] = useState<TeacherLessonTabKey>("plan");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(readModel.unifiedReadModel.steps[0]?.id ?? null);

  return (
    <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
      <TeacherLessonTabs tabs={mainTabs} activeTab={tab} onTabChange={setTab} tone="embedded" />

      <div className="mt-5">
        {tab === "plan" ? (
          <TeacherLessonPedagogicalContent
            quickSummary={readModel.unifiedReadModel.quickSummary}
            steps={readModel.unifiedReadModel.steps}
            durationLabel={readModel.metadata.durationLabel}
            activeStudentStepId={selectedStepId}
            onShowOnStudentScreen={setSelectedStepId}
            onOpenStudentScreen={() => setTab("student_screen")}
          />
        ) : null}

        {tab === "student_screen" ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="text-sm font-semibold text-neutral-800">Экран ученика</p>
              <button type="button" className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700">
                Открыть на весь экран
              </button>
            </div>
            <LessonStudentContentPanel
              title="Экран ученика"
              steps={readModel.unifiedReadModel.steps}
              source={readModel.studentContent.source}
              unavailableReason={readModel.studentContent.unavailableReason}
              assetsById={readModel.unifiedReadModel.assetsById}
              embedded
              mode="teacher_preview"
              controlledStepId={selectedStepId ?? undefined}
              onStepChange={setSelectedStepId}
            />
          </section>
        ) : null}

        {tab === "homework" ? (
          <LessonCanonicalHomeworkPanel homework={readModel.canonicalHomework} embedded />
        ) : null}
      </div>
    </SurfaceCard>
  );
}
