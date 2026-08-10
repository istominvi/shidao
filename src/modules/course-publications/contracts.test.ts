import assert from "node:assert/strict";
import test from "node:test";
import {
  CoursePublicationValidationError,
  parsePublicationContract,
  rightsConfirmationInputSchema,
} from "./contracts";

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
