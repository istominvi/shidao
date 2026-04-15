import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/server/app-session.ts", "utf8");

test("readAppSession remains request-bound and is not wrapped in React cache", () => {
  assert.equal(source.includes('import { cache } from "react"'), false);
  assert.equal(source.includes("export const readAppSession = cache"), false);
  assert.equal(source.includes("export async function readAppSession()"), true);
});
