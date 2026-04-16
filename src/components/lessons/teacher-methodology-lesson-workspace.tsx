"use client";

import { useState } from "react";
import { LessonCanonicalHomeworkPanel } from "@/components/lessons/lesson-canonical-homework-panel";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { TeacherLessonTabs, type TeacherLessonTabKey } from "@/components/lessons/teacher-lesson-tabs";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";

type MethodologyLessonReadModel = {
  presentation: Pick<
    TeacherLessonWorkspaceReadModel["presentation"],
    "quickSummary" | "lessonFlow" | "methodologyReference"
  >;
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
  studentContent: TeacherLessonWorkspaceReadModel["studentContent"];
};

export function TeacherMethodologyLessonWorkspace({ readModel }: { readModel: MethodologyLessonReadModel }) {
  const [tab, setTab] = useState<TeacherLessonTabKey>("plan");

  return (
    <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
      <TeacherLessonTabs
        tabs={["plan", "content", "homework"]}
        activeTab={tab}
        onTabChange={setTab}
        tone="embedded"
      />

      <div className="mt-5">
        {tab === "plan" ? (
          <TeacherLessonPedagogicalContent
            quickSummary={readModel.presentation.quickSummary}
            lessonFlow={readModel.presentation.lessonFlow}
            durationLabel={readModel.presentation.methodologyReference.durationLabel}
          />
        ) : null}

        {tab === "content" ? (
          <LessonStudentContentPanel
            source={readModel.studentContent.source}
            unavailableReason={readModel.studentContent.unavailableReason}
            assetsById={readModel.studentContent.assetsById}
            embedded
          />
        ) : null}

        {tab === "homework" ? <LessonCanonicalHomeworkPanel homework={readModel.canonicalHomework} embedded /> : null}
      </div>
    </SurfaceCard>
  );
}
