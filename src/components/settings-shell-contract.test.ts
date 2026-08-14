import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("profile, observers, and account settings share one product workspace", () => {
  const page = source("src/app/(app)/profile/page.tsx");
  const workspace = source(
    "src/components/learner-identity/learning-profile-workspace.tsx",
  );
  const accountSettings = source(
    "src/components/account/account-settings-panel.tsx",
  );
  const security = source(
    "src/app/(app)/(profile-required)/settings/security/security-settings-form.tsx",
  );
  const observers = source(
    "src/components/learner-identity/observers-settings-workspace.tsx",
  );

  assert.match(page, /<TopNav demoStyle \/>/);
  assert.match(page, /<LearningProfileWorkspace/);
  assert.match(workspace, /value: "profile", label: "Профиль"/);
  assert.match(workspace, /value: "observers",\s*label: "Наблюдатели"/);
  assert.match(workspace, /value: "settings",\s*label: "Настройки"/);
  assert.match(workspace, /<AccountSettingsPanel/);
  assert.match(workspace, /<ObserversSettingsWorkspace/);
  assert.match(workspace, /Promise\.allSettled/);
  assert.match(
    workspace,
    /historyResult\.status === "fulfilled"[\s\S]*?unavailableSections\.push\("история занятий"\)/,
  );
  assert.match(
    workspace,
    /session\.kind === "account" && surface === "settings"/,
  );
  assert.doesNotMatch(
    workspace,
    /!loading && profile && progress[\s\S]{0,160}<ObserversSettingsWorkspace/,
  );
  assert.doesNotMatch(
    workspace,
    /!loading &&[\s\S]{0,80}session\.kind === "account"[\s\S]{0,80}surface === "settings"/,
  );
  assert.match(workspace, /onHasPinChange=\{setHasPin\}/);
  assert.doesNotMatch(workspace, /value: "data"|value: "access"/);

  for (const panel of [accountSettings, security, observers]) {
    assert.doesNotMatch(panel, /SettingsShell|nav-settings-shell/);
  }
});

test("account settings actions and one-line fields use shared primitives", () => {
  const accountSettings = source(
    "src/components/account/account-settings-panel.tsx",
  );
  const security = source(
    "src/app/(app)/(profile-required)/settings/security/security-settings-form.tsx",
  );
  const observers = source(
    "src/components/learner-identity/observers-settings-workspace.tsx",
  );

  for (const settingsSource of [accountSettings, security, observers]) {
    assert.match(
      settingsSource,
      /import \{ Button(?:, productButtonClassName)? \} from "@\/components\/ui\/button"/,
    );
    assert.doesNotMatch(settingsSource, /<button\b/);
  }

  assert.match(accountSettings, /import \{ Input \}/);
  assert.match(observers, /import \{ Input \}/);
  assert.doesNotMatch(accountSettings, /<input\b/);
  assert.doesNotMatch(observers, /<input\b/);
  assert.match(
    accountSettings,
    /<Button type="submit" disabled=\{emailLoading\}>/,
  );
  assert.match(
    security,
    /<Button[\s\S]*?type="submit"[\s\S]*?disabled=\{loading\}[\s\S]*?className="w-full"/,
  );
  assert.match(security, /variant="secondary"[\s\S]*?>\s*Сменить логин и PIN/);
  assert.match(security, /variant="ghost"[\s\S]*?>\s*Отмена/);
  assert.equal((security.match(/id="security"/g) ?? []).length, 1);
});

test("legacy settings URLs redirect into the canonical profile tabs", () => {
  const learningProfile = source("src/app/(app)/learning-profile/page.tsx");
  const profile = source(
    "src/app/(app)/(profile-required)/settings/profile/page.tsx",
  );
  const security = source(
    "src/app/(app)/(profile-required)/settings/security/page.tsx",
  );
  const observers = source("src/app/(app)/settings/observers/page.tsx");
  const root = source("src/app/(app)/settings/page.tsx");

  assert.match(
    learningProfile,
    /profileCompatibilityHref\(await searchParams\)/,
  );
  for (const redirectPage of [profile, security, observers, root]) {
    assert.match(redirectPage, /profileCompatibilityHref\(await searchParams/);
  }
  assert.match(profile, /tab: "settings"/);
  assert.match(security, /tab: "settings"[\s\S]*fragment: "security"/);
  assert.match(observers, /tab: "observers"/);
  assert.match(root, /tab: "settings"/);
});
