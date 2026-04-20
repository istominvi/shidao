"use client";

import { Expand } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LessonLearnerContentDeck } from "@/components/lessons/lesson-learner-content-deck";
import { productButtonClassName } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { MethodologyLessonStudentContent, ReusableAsset } from "@/lib/lesson-content";
import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";
import { classNames } from "@/lib/ui/classnames";

type Props = {
  title?: string;
  steps?: MethodologyLessonStep[];
  source: MethodologyLessonStudentContent | null;
  unavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
  assetsById: Record<string, ReusableAsset>;
  embedded?: boolean;
  showFullscreenControl?: boolean;
  mode?: "teacher_preview" | "student_live_locked" | "student_review";
  controlledStepId?: string;
  onStepChange?: (stepId: string) => void;
};

export function LessonStudentContentPanel({
  title = "Экран ученика",
  steps,
  source,
  unavailableReason,
  assetsById,
  embedded = false,
  showFullscreenControl = false,
  mode = "teacher_preview",
  controlledStepId,
  onStepChange,
}: Props) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setIsFullscreenSupported(typeof document.fullscreenEnabled === "boolean" ? document.fullscreenEnabled : false);
    const handleFullscreenChange = () => {
      const container = containerRef.current;
      setIsFullscreen(Boolean(container && document.fullscreenElement === container));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleFullscreenToggle = async () => {
    if (typeof document === "undefined") return;
    const container = containerRef.current;
    if (!container || !isFullscreenSupported) return;
    try {
      if (document.fullscreenElement === container) {
        await document.exitFullscreen();
        return;
      }
      await container.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  const shouldShowFullscreenButton = isFullscreenSupported && (!embedded || showFullscreenControl);

  const fullscreenButton = shouldShowFullscreenButton ? (
    <button
      type="button"
      onClick={() => {
        void handleFullscreenToggle();
      }}
      className={productButtonClassName("secondary", "text-sm")}
    >
      <Expand className="h-4 w-4" aria-hidden="true" />
      {isFullscreen ? "Выйти из полноэкранного режима" : "На весь экран"}
    </button>
  ) : null;

  const deck = (
    <section
      ref={containerRef}
      className={classNames(
        "rounded-2xl",
        isFullscreen ? "bg-neutral-100 p-4 md:p-6" : "",
      )}
    >
      <LessonLearnerContentDeck
        steps={steps}
        source={source}
        unavailableReason={unavailableReason}
        assetsById={assetsById}
        compact={embedded}
        mode={mode}
        controlledStepId={controlledStepId}
        onStepChange={onStepChange}
      />
    </section>
  );

  const content = (
    <>
      {!embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {fullscreenButton}
          </div>
        </div>
      ) : null}

      {embedded && fullscreenButton ? (
        <div className="mb-3 flex justify-end">
          {fullscreenButton}
        </div>
      ) : null}

      {deck}
    </>
  );

  if (embedded) {
    return <section aria-label={title}>{content}</section>;
  }

  return <SurfaceCard>{content}</SurfaceCard>;
}
