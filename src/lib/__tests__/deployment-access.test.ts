import test from "node:test";
import assert from "node:assert/strict";
import {
  PROJECT_IN_DEVELOPMENT_PATH,
  isPrimaryPublicHost,
  isV2AppHost,
  normalizeRequestHost,
  resolvePrimaryHostRequestPolicy,
} from "../deployment-access";

test("deployment access normalizes forwarded hosts", () => {
  assert.equal(normalizeRequestHost("Shidao.Ru:443"), "shidao.ru");
  assert.equal(isPrimaryPublicHost("www.shidao.ru"), true);
  assert.equal(isV2AppHost("v2.shidao.ru:443"), true);
});

test("primary domain exposes only the landing and its public assets", () => {
  assert.equal(resolvePrimaryHostRequestPolicy("shidao.ru", "/"), "landing");
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", "/landing/screen_8.png"),
    "pass-through",
  );
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", "/methodologies/01.png"),
    "pass-through",
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
