import test from "node:test";
import assert from "node:assert/strict";
import { isSessionRevoked } from "../app-session";

const cutoffIso = "2026-06-30T12:00:00.000Z";
const cutoffMs = Date.parse(cutoffIso);

test("no cutoff means not revoked", () => {
  assert.equal(isSessionRevoked(cutoffMs, null), false);
  assert.equal(isSessionRevoked(cutoffMs, undefined), false);
});

test("session issued before the cutoff is revoked", () => {
  assert.equal(isSessionRevoked(cutoffMs - 1, cutoffIso), true);
});

test("session issued at or after the cutoff survives", () => {
  assert.equal(isSessionRevoked(cutoffMs, cutoffIso), false); // boundary: equal is valid
  assert.equal(isSessionRevoked(cutoffMs + 1, cutoffIso), false);
});

test("cutoff accepted as ISO string, epoch ms, and Date", () => {
  assert.equal(isSessionRevoked(cutoffMs - 1000, cutoffIso), true);
  assert.equal(isSessionRevoked(cutoffMs - 1000, cutoffMs), true);
  assert.equal(isSessionRevoked(cutoffMs - 1000, new Date(cutoffMs)), true);
});

test("unparseable cutoff fails open (not revoked) to avoid lockout", () => {
  assert.equal(isSessionRevoked(cutoffMs, "not-a-date"), false);
});
