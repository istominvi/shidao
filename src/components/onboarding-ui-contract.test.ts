import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("onboarding uses the protected app chrome and canonical form primitives", () => {
  const page = source("src/app/(app)/onboarding/page.tsx");
  const client = source("src/app/(app)/onboarding/page-client.tsx");
  const appLayout = source("src/app/(app)/layout.tsx");
  const accessGuards = source("src/lib/server/access-guards.ts");
  const topNav = source("src/components/top-nav.tsx");

  assert.match(page, /import "\.\.\/\.\.\/styles\/onboarding\.css"/);
  assert.doesNotMatch(page, /resolveAccessPolicy|redirect\(/);
  assert.match(appLayout, /resolveAppLayoutRedirect\(resolution\.status\)/);
  assert.doesNotMatch(accessGuards, /resolveOnboardingRedirect/);
  assert.match(topNav, /pathname === ROUTES\.onboarding/);

  assert.match(
    client,
    /<main className="app-page-shell onboarding-page-shell pb-12">/,
  );
  assert.match(client, /<AppPageHeader/);
  assert.doesNotMatch(client, /<AppPageHeader[\s\S]*?metric=/);
  assert.match(client, /<SurfaceCard/);
  assert.match(client, /<SurfaceCard[\s\S]*?description="Эти общие настройки/);
  assert.equal((client.match(/<FormField/g) ?? []).length, 3);
  assert.equal((client.match(/<FieldLabel/g) ?? []).length, 3);
  assert.equal((client.match(/<Input/g) ?? []).length, 1);
  assert.equal((client.match(/<Select/g) ?? []).length, 2);
  assert.match(client, /<Alert tone="error">/);
  assert.match(client, /<Button type="submit"/);

  assert.doesNotMatch(
    client,
    /ProductShell|PageHero|StatusMessage|primary-form-card|<label/,
  );
});

test("onboarding layout styles stay route-scoped", () => {
  const styles = source("src/app/styles/onboarding.css");

  assert.match(styles, /\.onboarding-workspace/);
  assert.match(styles, /\.app-page-shell \.onboarding-profile-card/);
  assert.match(styles, /\.onboarding-form-grid/);
  assert.doesNotMatch(
    styles,
    /(?:^|\n)\s*(?:html|body|:root|\.surface-card)\b/,
  );
});
