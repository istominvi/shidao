import assert from "node:assert/strict";
import test from "node:test";
import { getStudentSlidePlacementOptions } from "./student-slide-placement";

const slides = [
  { id: "slide-1", position: 1 },
  { id: "slide-2", position: 2 },
  { id: "slide-3", position: 3 },
];

test("slide choices cannot invert the canonical component order", () => {
  const options = getStudentSlidePlacementOptions(
    [
      { id: "before", studentSlideId: "slide-2" },
      { id: "current", studentSlideId: null },
      { id: "after", studentSlideId: "slide-3" },
    ],
    "current",
    slides,
  );

  assert.deepEqual(
    options.existingSlides.map((slide) => slide.id),
    ["slide-2", "slide-3"],
  );
  assert.equal(options.canCreateNew, true);
});

test("new slide is unavailable between neighbours on the same slide", () => {
  const options = getStudentSlidePlacementOptions(
    [
      { id: "before", studentSlideId: "slide-2" },
      { id: "current", studentSlideId: "slide-1" },
      { id: "after", studentSlideId: "slide-2" },
    ],
    "current",
    slides,
  );

  assert.deepEqual(options.existingSlides, [{ id: "slide-2", position: 2 }]);
  assert.equal(options.canCreateNew, false);
});

test("first, last, and only visible positions retain a legal new slide choice", () => {
  assert.equal(
    getStudentSlidePlacementOptions(
      [
        { id: "current", studentSlideId: null },
        { id: "after", studentSlideId: "slide-2" },
      ],
      "current",
      slides,
    ).canCreateNew,
    true,
  );
  assert.equal(
    getStudentSlidePlacementOptions(
      [
        { id: "before", studentSlideId: "slide-2" },
        { id: "current", studentSlideId: null },
      ],
      "current",
      slides,
    ).canCreateNew,
    true,
  );
  assert.equal(
    getStudentSlidePlacementOptions(
      [{ id: "current", studentSlideId: null }],
      "current",
      slides,
    ).canCreateNew,
    true,
  );
});

test("unknown current component fails closed", () => {
  assert.deepEqual(getStudentSlidePlacementOptions([], "missing", slides), {
    existingSlides: [],
    canCreateNew: false,
  });
});
