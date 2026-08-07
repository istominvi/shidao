import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_HOST,
  PROJECT_IN_DEVELOPMENT_PATH,
  isDemoHost,
  isDemoPublicAsset,
  isIdentityInvitationPage,
  isPrimaryPublicHost,
  isV2AppHost,
  normalizeRequestHost,
  resolveDeploymentHostPolicy,
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

test("only exact identity invitation pages receive the secret-safe page policy", () => {
  assert.equal(
    isIdentityInvitationPage(
      "/identity/invitations/00000000-0000-4000-8000-000000000001",
    ),
    true,
  );
  assert.equal(isIdentityInvitationPage("/identity/invitations"), false);
  assert.equal(
    isIdentityInvitationPage("/identity/invitations/id/extra"),
    false,
  );
});

test("primary domain exposes only the landing and its public assets", () => {
  assert.equal(resolvePrimaryHostRequestPolicy("shidao.ru", "/"), "landing");
  assert.equal(
    resolvePrimaryHostRequestPolicy("shidao.ru", "/landing/screen_8.png"),
    "pass-through",
  );
  for (const template of [
    "confirmation.html",
    "email-change.html",
    "invite.html",
    "recovery.html",
  ]) {
    assert.equal(
      resolvePrimaryHostRequestPolicy(
        "shidao.ru",
        `/email-templates/${template}`,
      ),
      "pass-through",
    );
  }
  assert.equal(
    resolvePrimaryHostRequestPolicy(
      "shidao.ru",
      "/email-templates/untracked.html",
    ),
    "maintenance",
  );
  assert.equal(
    resolvePrimaryHostRequestPolicy(
      "shidao.ru",
      "/email-templates/../private.txt",
    ),
    "maintenance",
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

test("production host allowlist rejects unknown and deep brand/model requests", () => {
  for (const host of [
    "shidao.ru",
    "www.shidao.ru",
    "v2.shidao.ru",
    "demo.shidao.ru",
  ]) {
    assert.equal(
      resolveDeploymentHostPolicy(host, "/anything", "production"),
      "allowed",
    );
  }
  assert.equal(
    resolveDeploymentHostPolicy("brand.shidao.ru", "/", "production"),
    "allowed",
  );
  assert.equal(
    resolveDeploymentHostPolicy("model.shidao.ru", "/", "production"),
    "allowed",
  );
  assert.equal(
    resolveDeploymentHostPolicy(
      "brand.shidao.ru",
      "/api/auth/session",
      "production",
    ),
    "blocked",
  );
  assert.equal(
    resolveDeploymentHostPolicy("model.shidao.ru", "/courses", "production"),
    "blocked",
  );
  assert.equal(
    resolveDeploymentHostPolicy("unknown.shidao.ru", "/", "production"),
    "blocked",
  );
  assert.equal(
    resolveDeploymentHostPolicy("localhost:3000", "/", "production"),
    "blocked",
  );
  assert.equal(
    resolveDeploymentHostPolicy("localhost:3000", "/", "development"),
    "allowed",
  );
});
