import Link from "next/link";
import { LessonLearnerContentDeck } from "@/components/lessons/lesson-learner-content-deck";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { MethodologyLessonStudentContent, ReusableAsset } from "@/lib/lesson-content";

type Props = {
  title?: string;
  source: MethodologyLessonStudentContent | null;
  unavailableReason: "schema_missing" | "invalid_payload" | "load_failed" | null;
  assetsById: Record<string, ReusableAsset>;
  previewHref?: string;
  embedded?: boolean;
};

export function LessonStudentContentPanel({
  title = "Контент",
  source,
  unavailableReason,
  assetsById,
  previewHref,
  embedded = false,
}: Props) {
  const content = (
    <>
      {!embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          {previewHref ? (
            <Link href={previewHref} className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
              Предпросмотр ученической версии
            </Link>
          ) : null}
        </div>
      ) : previewHref ? (
        <div className="mb-4">
          <Link href={previewHref} className="inline-flex rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
            Предпросмотр ученической версии
          </Link>
        </div>
      ) : null}

      <LessonLearnerContentDeck source={source} unavailableReason={unavailableReason} assetsById={assetsById} compact={embedded} />
    </>
  );

  if (embedded) {
    return <section aria-label={title}>{content}</section>;
  }

  return <SurfaceCard>{content}</SurfaceCard>;
}
