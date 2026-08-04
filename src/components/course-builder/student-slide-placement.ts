export type StudentSlidePlacementSlide = {
  id: string;
  position: number;
};

export type StudentSlidePlacementComponent = {
  id: string;
  studentSlideId: string | null;
};

export type StudentSlidePlacementOptions = {
  existingSlides: StudentSlidePlacementSlide[];
  canCreateNew: boolean;
};

/**
 * Keeps Student Screen grouping monotonic with the one canonical Lesson
 * component order. The current component is intentionally excluded when its
 * nearest visible neighbours are calculated.
 */
export function getStudentSlidePlacementOptions(
  components: StudentSlidePlacementComponent[],
  currentComponentId: string,
  slides: StudentSlidePlacementSlide[],
): StudentSlidePlacementOptions {
  const currentIndex = components.findIndex(
    (component) => component.id === currentComponentId,
  );
  if (currentIndex < 0) {
    return { existingSlides: [], canCreateNew: false };
  }

  const predecessor = components
    .slice(0, currentIndex)
    .reverse()
    .find((component) => component.studentSlideId !== null);
  const successor = components
    .slice(currentIndex + 1)
    .find((component) => component.studentSlideId !== null);
  const slidePositionById = new Map(
    slides.map((slide) => [slide.id, slide.position]),
  );
  const predecessorPosition = predecessor?.studentSlideId
    ? slidePositionById.get(predecessor.studentSlideId)
    : undefined;
  const successorPosition = successor?.studentSlideId
    ? slidePositionById.get(successor.studentSlideId)
    : undefined;

  const existingSlides = [...slides]
    .sort((left, right) => left.position - right.position)
    .filter(
      (slide) =>
        (predecessorPosition === undefined ||
          slide.position >= predecessorPosition) &&
        (successorPosition === undefined ||
          slide.position <= successorPosition),
    );

  return {
    existingSlides,
    canCreateNew:
      !predecessor ||
      !successor ||
      predecessor.studentSlideId !== successor.studentSlideId,
  };
}
