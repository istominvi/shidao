import assert from "node:assert/strict";
import test from "node:test";
import {
  coursePublicationStorageCopyBody,
  resolveCoursePublicationSignedUrl,
} from "./storage-contract";

test("Storage copy body uses the self-hosted Supabase REST contract", () => {
  assert.deepEqual(
    coursePublicationStorageCopyBody({
      sourceBucket: "course-assets",
      sourcePath: "owner/courses/source/file.pdf",
      destinationBucket: "course-publication-assets",
      destinationPath: "publication/revisions/revision/assets/asset",
    }),
    {
      bucketId: "course-assets",
      sourceKey: "owner/courses/source/file.pdf",
      destinationBucket: "course-publication-assets",
      destinationKey: "publication/revisions/revision/assets/asset",
    },
  );
});

test("leading-slash signed paths retain the /storage/v1 prefix", () => {
  assert.equal(
    resolveCoursePublicationSignedUrl(
      "https://supabase.example.test",
      "/object/sign/course-publication-assets/file?token=secret",
    ),
    "https://supabase.example.test/storage/v1/object/sign/course-publication-assets/file?token=secret",
  );
});
