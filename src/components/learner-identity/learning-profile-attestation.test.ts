import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const workspace = source(
  "src/components/learner-identity/learning-profile-workspace.tsx",
);
const client = source("src/components/learner-identity/identity-client.ts");

test("learning profile exposes a lazy account attestation surface", () => {
  assert.match(workspace, /type Surface =[^;]*"attestation"/);
  assert.match(
    workspace,
    /value: "attestation",\s*label: "Аттестация",\s*icon: BadgeCheck/,
  );
  assert.match(workspace, /surface !== "attestation"/);
  assert.match(workspace, /attestations !== null/);
  assert.match(workspace, /attestationRequestInFlightRef\.current/);
  assert.match(workspace, /void loadAttestations\(\)/);

  const initialProfileLoad = workspace.match(
    /const load = useCallback\([\s\S]*?\n  }, \[\]\);/,
  )?.[0];
  assert.ok(initialProfileLoad, "expected the initial profile loader");
  assert.doesNotMatch(initialProfileLoad, /loadAccountAttestations/);
});

test("attestation client reads the bounded self endpoint", () => {
  assert.match(
    client,
    /import type \{ AccountAttestationCredential \} from "@\/modules\/course-attestations\/domain"/,
  );
  assert.match(
    client,
    /requestJson<\{\s*attestations: AccountAttestationCredential\[\];\s*\}>\("\/api\/v2\/me\/attestations"\)/,
  );
});

test("attestation surface covers loading, error, empty, and credential states", () => {
  assert.match(
    workspace,
    /<IdentityLoading>Загружаем аттестации…<\/IdentityLoading>/,
  );
  assert.match(
    workspace,
    /<IdentityError\s+message=\{attestationsError\}\s+onRetry=\{\(\) => void loadAttestations\(\)\}/,
  );
  assert.match(workspace, /title="Аттестаций пока нет"/);
  assert.match(workspace, /Аттестован по курсу/);
  assert.match(workspace, /не государственное\s+удостоверение/);

  for (const field of [
    "courseTitle",
    "courseSubject",
    "assessmentTitle",
    "publisherDisplayName",
    "scorePercent",
    "passingScorePercent",
    "completedAt",
    "assessmentVersion",
    "isCurrentRevision",
    "publicationAvailable",
  ]) {
    assert.match(workspace, new RegExp(`attestation\\.${field}`));
  }
});
