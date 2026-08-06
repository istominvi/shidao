import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_HOST,
  PROJECT_IN_DEVELOPMENT_PATH,
  isDemoHost,
  isDemoPublicAsset,
  isPrimaryPublicHost,
  isV2AppHost,
  normalizeRequestHost,
  resolvePrimaryHostRequestPolicy,
} from "../deployment-access";

test("deployment access normalizes forwarded hosts", () => {
  assert.equal(normalizeRequestHost("Shidao.Ru:443"), "shidao.ru");
  assert.equal(isPrimaryPublicHost("www.shidao.ru"), true);
  assert.equal(isV2AppHost("v2.shidao.ru:443"), true);
  assert.equal(isDemoHost("Demo.Shidao.Ru:443"), true);
  assert.equal(DEMO_HOST, "demo.shidao.ru");
});

test("standalone demo recognizes only its dedicated public assets", () => {
  assert.equal(isDemoPublicAsset("/og-demo-v2.png"), true);
  assert.equal(isDemoPublicAsset("/favicon.svg"), true);
  assert.equal(isDemoPublicAsset("/api/auth/session"), false);
  assert.equal(isDemoPublicAsset("/courses"), false);
});

test("primary domain exposes only the landing and its public assets", () => {
  assert.equal(resolvePrimaryHostRequestPolicy("shidao.ru", "/"), "landing");
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", "/landing/screen_8.png"),
    "pass-through",
  );
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", "/methodologies/01.png"),
    "maintenance",
  );
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", "/dashboard"),
    "maintenance",
  );
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", "/login"),
    "maintenance",
  );
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", "/api/auth/login"),
    "blocked-api",
  );
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", PROJECT_IN_DEVELOPMENT_PATH),
    "maintenance-page",
  );
});

test("v2 and local hosts retain the complete application", () => {
  assert.equal(
    resolvePrimaryHostRequestPolicy("v2.shidao.ru", "/dashboard"),
    "pass-through",
  );
  assert.equal(
    resolvePrimaryHostRequestPolicy("localhost:3000", "/login"),
    "pass-through",
  );
});
