import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("ordinary product CTAs use the canonical raised button primitive", () => {
  const onboarding = source("src/app/(app)/onboarding/page-client.tsx");
  const forgotPassword = source("src/app/(auth)/forgot-password/page.tsx");
  const resetPassword = source("src/app/(auth)/reset-password/page.tsx");
  const checkEmail = source("src/app/(auth)/join/check-email/page.tsx");
  const identityUi = source("src/components/learner-identity/identity-ui.tsx");
  const invitation = source(
    "src/components/learner-identity/invitation-accept-workspace.tsx",
  );

  assert.match(
    onboarding,
    /import \{ Button \} from "@\/components\/ui\/button"/,
  );
  assert.match(onboarding, /<Button\s+type="submit"[\s\S]*?className="w-full"/);
  assert.doesNotMatch(onboarding, /<button[\s\S]*?Сохранить и продолжить/);

  for (const authPage of [forgotPassword, resetPassword]) {
    assert.match(
      authPage,
      /import \{ Button \} from "@\/components\/ui\/button"/,
    );
    assert.match(authPage, /<Button[\s\S]*?type="submit"/);
    assert.doesNotMatch(authPage, /landing-btn/);
  }

  assert.match(checkEmail, /productButtonClassName/);
  assert.match(
    checkEmail,
    /className=\{productButtonClassName\("primary", "px-8"\)\}/,
  );
  assert.match(identityUi, /<Button[\s\S]*?className="product-btn-danger"/);
  assert.equal(
    (invitation.match(/productButtonClassName\(/g) ?? []).length,
    4,
    "every ordinary invitation CTA link must use the shared raised contract",
  );
});

test("standalone account fields adopt the canonical single-line input primitive", () => {
  const onboarding = source("src/app/(app)/onboarding/page-client.tsx");
  const accountSettings = source(
    "src/components/account/account-settings-panel.tsx",
  );
  const security = source(
    "src/app/(app)/(profile-required)/settings/security/security-settings-form.tsx",
  );
  const observers = source(
    "src/components/learner-identity/observers-settings-workspace.tsx",
  );

  assert.match(
    onboarding,
    /import \{ Input, Select \} from "@\/components\/ui\/input"/,
  );
  assert.equal((onboarding.match(/<Input/g) ?? []).length, 1);
  assert.equal((onboarding.match(/<Select/g) ?? []).length, 2);
  assert.doesNotMatch(
    onboarding,
    /rounded-2xl border border-black\/10 bg-white/,
  );

  assert.match(
    accountSettings,
    /import \{ Input \} from "@\/components\/ui\/input"/,
  );
  assert.equal((accountSettings.match(/<Input/g) ?? []).length, 2);
  assert.match(security, /import \{ Input \} from "@\/components\/ui\/input"/);
  assert.equal((security.match(/<Input/g) ?? []).length, 5);
  assert.match(observers, /import \{ Input \} from "@\/components\/ui\/input"/);
  assert.equal((observers.match(/<Input/g) ?? []).length, 3);
  assert.doesNotMatch(observers, /window\.(prompt|confirm)/);
});
