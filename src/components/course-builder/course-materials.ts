import type {
  CourseAsset,
  CourseWorkspace,
} from "@/modules/course-builder/domain";
import { extractComponentStoredFileReferences } from "@/modules/course-builder/registry/stored-file-references";

export type CourseMaterialLessonUsage = {
  lessonId: string;
  lessonPosition: number;
  lessonTitle: string;
  componentCount: number;
  occurrenceCount: number;
  learnerVisible: boolean;
};

export type CourseMaterialItem = {
  asset: CourseAsset;
  usages: CourseMaterialLessonUsage[];
};

export type CourseMaterialsProjection = {
  used: CourseMaterialItem[];
  unused: CourseMaterialItem[];
  unresolvedReferenceCount: number;
  invalidComponentCount: number;
};

type MutableUsage = CourseMaterialLessonUsage & {
  componentIds: Set<string>;
};

export function projectCourseMaterials(
  course: CourseWorkspace,
): CourseMaterialsProjection {
  const attachmentIds = new Set(course.attachments.map((asset) => asset.id));
  const usagesByAsset = new Map<string, Map<string, MutableUsage>>();
  let unresolvedReferenceCount = 0;
  let invalidComponentCount = 0;

  for (const lesson of course.lessons) {
    for (const component of lesson.components) {
      let references: string[];
      try {
        references = extractComponentStoredFileReferences(
          component.typeKey,
          component.payload,
        );
      } catch {
        invalidComponentCount += 1;
        continue;
      }

      const occurrences = new Map<string, number>();
      for (const assetId of references) {
        occurrences.set(assetId, (occurrences.get(assetId) ?? 0) + 1);
      }

      for (const [assetId, occurrenceCount] of occurrences) {
        if (!attachmentIds.has(assetId)) {
          unresolvedReferenceCount += occurrenceCount;
          continue;
        }

        let lessonUsages = usagesByAsset.get(assetId);
        if (!lessonUsages) {
          lessonUsages = new Map();
          usagesByAsset.set(assetId, lessonUsages);
        }

        const current = lessonUsages.get(lesson.id) ?? {
          lessonId: lesson.id,
          lessonPosition: lesson.position,
          lessonTitle: lesson.title,
          componentCount: 0,
          occurrenceCount: 0,
          learnerVisible: false,
          componentIds: new Set<string>(),
        };
        current.componentIds.add(component.id);
        current.componentCount = current.componentIds.size;
        current.occurrenceCount += occurrenceCount;
        current.learnerVisible ||=
          component.visibility === "learner_visible" &&
          component.studentSlideId !== null;
        lessonUsages.set(lesson.id, current);
      }
    }
  }

  const items = course.attachments.map((asset): CourseMaterialItem => ({
    asset,
    usages: [...(usagesByAsset.get(asset.id)?.values() ?? [])]
      .sort((left, right) => left.lessonPosition - right.lessonPosition)
      .map(({ componentIds: _componentIds, ...usage }) => usage),
  }));

  return {
    used: items.filter((item) => item.usages.length > 0),
    unused: items.filter((item) => item.usages.length === 0),
    unresolvedReferenceCount,
    invalidComponentCount,
  };
}
