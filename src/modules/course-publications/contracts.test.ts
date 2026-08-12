import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogQuerySchema,
  CoursePublicationValidationError,
  parsePublicationContract,
  rightsConfirmationInputSchema,
} from "./contracts";

test("catalog audience defaults to children and accepts educators", () => {
  assert.equal(catalogQuerySchema.parse({}).learningAudience, "children");
  assert.equal(
    catalogQuerySchema.parse({ learningAudience: "educators" })
      .learningAudience,
    "educators",
  );
  assert.equal(
    catalogQuerySchema.safeParse({ learningAudience: "all" }).success,
    false,
  );
});

test("publication rights confirmation is explicit and strict", () => {
  assert.deepEqual(
    parsePublicationContract(rightsConfirmationInputSchema, {
      rightsConfirmed: true,
    }),
    { rightsConfirmed: true },
  );
  assert.throws(
    () =>
      parsePublicationContract(rightsConfirmationInputSchema, {
        rightsConfirmed: false,
      }),
    CoursePublicationValidationError,
  );
  assert.throws(
    () =>
      parsePublicationContract(rightsConfirmationInputSchema, {
        rightsConfirmed: true,
        previewAccepted: true,
      }),
    CoursePublicationValidationError,
  );
});
