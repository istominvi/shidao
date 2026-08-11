import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("authenticated Settings reuse the canonical active product shell", () => {
  const shell = source("src/components/settings-shell.tsx");
  const navigationStyles = source("src/app/styles/navigation.css");

  assert.match(
    shell,
    /<main className="course-demo-shell settings-product-shell">/,
  );
  assert.match(shell, /<TopNav demoStyle \/>/);
  assert.match(shell, /<SettingsNavigation \/>/);
  assert.match(
    navigationStyles,
    /\.course-demo-shell \.nav-settings-shell \.nav-pill\s*\{[^}]*min-height: var\(--course-demo-control-height\);[^}]*border-radius: var\(--course-demo-control-radius\);[^}]*font-size: var\(--course-demo-control-font-size\);[^}]*font-weight: var\(--course-demo-control-font-weight\);/,
  );
  assert.match(
    navigationStyles,
    /\.course-demo-shell \.nav-settings-shell \.nav-pill-active\s*\{[^}]*box-shadow: none;/,
  );
});

test("Settings actions use shared button variants without raw visual forks", () => {
  const profile = source(
    "src/app/(app)/(profile-required)/settings/profile/page.tsx",
  );
  const security = source(
    "src/app/(app)/(profile-required)/settings/security/security-settings-form.tsx",
  );
  const observers = source(
    "src/components/learner-identity/observers-settings-workspace.tsx",
  );

  for (const settingsSource of [profile, security, observers]) {
    assert.match(
      settingsSource,
      /import \{ Button \} from "@\/components\/ui\/button"/,
    );
    assert.doesNotMatch(settingsSource, /<button\b/);
  }

  assert.match(
    profile,
    /<Button[\s\S]*?type="submit"[\s\S]*?disabled=\{emailLoading\}[\s\S]*?className="w-full"/,
  );
  assert.match(
    security,
    /<Button[\s\S]*?type="submit"[\s\S]*?disabled=\{loading\}[\s\S]*?className="w-full"/,
  );
  assert.match(security, /variant="secondary"[\s\S]*?>\s*Сменить логин и PIN/);
  assert.match(security, /variant="ghost"[\s\S]*?>\s*Отмена/);
  assert.match(
    security,
    /variant="secondary"[\s\S]*?className="product-btn-danger"[\s\S]*?>\s*Отозвать право/,
  );
});
