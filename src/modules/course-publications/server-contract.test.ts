import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

test("service-role publication adapters are server-only and absent from client modules", () => {
  for (const path of [
    "src/modules/course-publications/repository.ts",
    "src/modules/course-publications/storage.ts",
    "src/modules/course-publications/mutation-guard.ts",
  ]) {
    assert.match(source(path), /^import "server-only";/);
  }
  for (const path of sourceFiles(join(process.cwd(), "src"))) {
    const contents = readFileSync(path, "utf8");
    if (!/^\s*["']use client["'];/m.test(contents)) continue;
    assert.doesNotMatch(
      contents,
      /course-publications\/(?:repository|storage|mutation-guard|server-context)/,
      `Client module imports elevated adapter: ${path}`,
    );
  }
});

test("repository sends the fixed admin RPC names and complete publish arguments", () => {
  const repository = source("src/modules/course-publications/repository.ts");
  for (const rpc of [
    "publish_course_revision_admin",
    "unpublish_course_publication_admin",
    "clone_course_publication_admin",
    "duplicate_course_admin",
    "list_course_publication_catalog_admin",
  ]) {
    assert.match(repository, new RegExp(`"${rpc}"`));
  }
  for (const argument of [
    "p_actor_account_id",
    "p_source_course_id",
    "p_publication_id",
    "p_revision_id",
    "p_content_sha256",
    "p_snapshot",
    "p_asset_manifest",
    "p_rights_confirmed",
  ]) {
    assert.match(repository, new RegExp(`${argument}:`));
  }
  assert.match(repository, /Authorization: `Bearer \$\{serviceRoleKey\}`/);
  for (const argument of [
    "p_q",
    "p_subject",
    "p_level",
    "p_offset",
    "p_limit",
  ]) {
    assert.match(repository, new RegExp(`${argument}:`));
  }
  assert.doesNotMatch(repository, /listCatalogCandidates/);
});

test("Storage broker verifies every copy and keeps cleanup private", () => {
  const storage = source("src/modules/course-publications/storage.ts");
  assert.match(storage, /\/storage\/v1\/object\/copy/);
  assert.match(storage, /\/storage\/v1\/object\/info\//);
  assert.match(storage, /rawSize !== input\.expectedSizeBytes/);
  assert.match(storage, /rawMime !== input\.expectedMimeType/);
  assert.match(storage, /method: "DELETE"/);
});

test("route surface has catalog, publication, copy and duplicate without preview", () => {
  const routes = [
    "src/app/api/v2/course-catalog/route.ts",
    "src/app/api/v2/course-catalog/[publicationId]/route.ts",
    "src/app/api/v2/course-catalog/[publicationId]/copy/route.ts",
    "src/app/api/v2/courses/[courseId]/publication/route.ts",
    "src/app/api/v2/courses/[courseId]/duplicate/route.ts",
  ];
  for (const route of routes) assert.equal(existsSync(route), true, route);
  const publication = source(
    "src/app/api/v2/courses/[courseId]/publication/route.ts",
  );
  assert.match(publication, /export async function GET/);
  assert.match(publication, /export async function POST/);
  assert.match(publication, /export async function PUT/);
  assert.match(publication, /export async function DELETE/);
  assert.equal(
    existsSync("src/app/api/v2/courses/[courseId]/publication/preview"),
    false,
  );
});
