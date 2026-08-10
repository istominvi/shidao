export function coursePublicationStorageCopyBody(input: {
  sourceBucket: string;
  sourcePath: string;
  destinationBucket: string;
  destinationPath: string;
}) {
  return {
    bucketId: input.sourceBucket,
    sourceKey: input.sourcePath,
    destinationBucket: input.destinationBucket,
    destinationKey: input.destinationPath,
  };
}

export function resolveCoursePublicationSignedUrl(
  supabaseUrl: string,
  signedPath: string,
) {
  if (/^https?:\/\//i.test(signedPath)) return signedPath;
  return new URL(
    `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/${signedPath.replace(/^\/+/, "")}`,
  ).toString();
}
