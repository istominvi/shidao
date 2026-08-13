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

export type StudentScreenToggleInput =
  { mode: "hide" } | { mode: "existing"; slideId: string } | { mode: "new" };

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

/**
 * Turns the Student Screen membership control into a deterministic toggle.
 * A newly shown component joins the preceding visible component's Slide when
 * possible, then the following visible component's Slide, and only creates a
 * Slide when the Lesson has no visible neighbour.
 */
export function getStudentScreenToggleInput(
  components: StudentSlidePlacementComponent[],
  currentComponentId: string,
  slides: StudentSlidePlacementSlide[],
): StudentScreenToggleInput | null {
  const currentIndex = components.findIndex(
    (component) => component.id === currentComponentId,
  );
  if (currentIndex < 0) return null;

  const current = components[currentIndex]!;
  if (current.studentSlideId !== null) return { mode: "hide" };

  const validSlideIds = new Set(
    getStudentSlidePlacementOptions(
      components,
      currentComponentId,
      slides,
    ).existingSlides.map((slide) => slide.id),
  );
  const predecessor = components
    .slice(0, currentIndex)
    .reverse()
    .find(
      (component) =>
        component.studentSlideId !== null &&
        validSlideIds.has(component.studentSlideId),
    );
  if (predecessor?.studentSlideId) {
    return { mode: "existing", slideId: predecessor.studentSlideId };
  }

  const successor = components
    .slice(currentIndex + 1)
    .find(
      (component) =>
        component.studentSlideId !== null &&
        validSlideIds.has(component.studentSlideId),
    );
  if (successor?.studentSlideId) {
    return { mode: "existing", slideId: successor.studentSlideId };
  }

  return { mode: "new" };
}
