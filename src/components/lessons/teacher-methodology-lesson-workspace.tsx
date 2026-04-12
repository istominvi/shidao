"use client";

import { useState } from "react";
import { LessonCanonicalHomeworkPanel } from "@/components/lessons/lesson-canonical-homework-panel";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { TeacherLessonTabs, type TeacherLessonTabKey } from "@/components/lessons/teacher-lesson-tabs";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";

type MethodologyLessonReadModel = {
  presentation: Pick<TeacherLessonWorkspaceReadModel["presentation"], "quickSummary" | "lessonFlow">;
  canonicalHomework: {
    title: string;
    kindLabel: string;
    instructions: string;
    estimatedMinutes: number | null;
    materialLinks: string[];
    answerFormatHint: string | null;
    sourceLayerNote: string;
  } | null;
  studentContent: TeacherLessonWorkspaceReadModel["studentContent"];
};

export function TeacherMethodologyLessonWorkspace({ readModel }: { readModel: MethodologyLessonReadModel }) {
  const [tab, setTab] = useState<TeacherLessonTabKey>("plan");

  return (
    <section className="space-y-5">
      <TeacherLessonTabs tabs={["plan", "content", "homework"]} activeTab={tab} onTabChange={setTab} />

      {tab === "plan" ? (
        <TeacherLessonPedagogicalContent
          quickSummary={readModel.presentation.quickSummary}
          lessonFlow={readModel.presentation.lessonFlow}
        />
      ) : null}

      {tab === "content" ? (
        <LessonStudentContentPanel
          source={readModel.studentContent.source}
          unavailableReason={readModel.studentContent.unavailableReason}
          assetsById={readModel.studentContent.assetsById}
        />
      ) : null}

      {tab === "homework" ? <LessonCanonicalHomeworkPanel homework={readModel.canonicalHomework} /> : null}
    </section>
  );
}
