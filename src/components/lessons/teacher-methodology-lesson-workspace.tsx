"use client";

import { useState } from "react";
import { LessonCanonicalHomeworkPanel } from "@/components/lessons/lesson-canonical-homework-panel";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import {
  TeacherLessonTabs,
  type TeacherLessonTabKey,
} from "@/components/lessons/teacher-lesson-tabs";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { MethodologyLessonUnifiedReadModel } from "@/lib/server/methodology-lesson-unified-read-model";

type MethodologyLessonReadModel = {
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
  unifiedReadModel: MethodologyLessonUnifiedReadModel;
};

const mainTabs: TeacherLessonTabKey[] = ["plan", "student_screen", "homework"];

export function TeacherMethodologyLessonWorkspace({
  readModel,
}: {
  readModel: MethodologyLessonReadModel;
}) {
  const [tab, setTab] = useState<TeacherLessonTabKey>("plan");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    readModel.unifiedReadModel.steps[0]?.id ?? null,
  );
  const isWorldAroundMeLessonOne =
    readModel.unifiedReadModel.lesson.title.includes("Урок 1");

  return (
    <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
      <TeacherLessonTabs
        tabs={mainTabs}
        activeTab={tab}
        onTabChange={setTab}
        tone="embedded"
      />

      <div className="mt-5">
        {tab === "plan" ? (
          <TeacherLessonPedagogicalContent
            quickSummary={readModel.unifiedReadModel.quickSummary}
            steps={readModel.unifiedReadModel.steps}
            durationLabel={readModel.unifiedReadModel.lesson.durationLabel}
            summaryNote={
              isWorldAroundMeLessonOne
                ? "Первый урок знакомит детей с животными фермы через видео, карточки, движение, счёт, игрушечную ферму и песню. Учитель ведёт детей от повторения отдельных слов к коротким моделям 我是… / 这是… / 在…里."
                : null
            }
            activeStudentStepId={selectedStepId}
            assetsById={readModel.unifiedReadModel.assetsById}
            onShowOnStudentScreen={setSelectedStepId}
            onOpenStudentScreen={(stepId) => {
              setSelectedStepId(stepId);
              setTab("student_screen");
            }}
          />
        ) : null}

        {tab === "student_screen" ? (
          <section>
            <LessonStudentContentPanel
              title="Экран ученика"
              steps={readModel.unifiedReadModel.steps}
              source={null}
              unavailableReason={null}
              assetsById={readModel.unifiedReadModel.assetsById}
              embedded
              showFullscreenControl
              mode="teacher_preview"
              controlledStepId={selectedStepId ?? undefined}
              onStepChange={setSelectedStepId}
            />
          </section>
        ) : null}

        {tab === "homework" ? (
          <LessonCanonicalHomeworkPanel
            homework={readModel.canonicalHomework}
            embedded
          />
        ) : null}
      </div>
    </SurfaceCard>
  );
}
