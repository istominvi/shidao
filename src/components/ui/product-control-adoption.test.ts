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
    /className=\{productButtonClassName\("inverse", "auth-submit"\)\}/,
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
    "src/app/(app)/settings/security/security-settings-form.tsx",
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

type ExpectedAuthInput = {
  id: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  maxLength: number;
};

function assertCanonicalAuthInputs(
  pageName: string,
  pageSource: string,
  expected: ExpectedAuthInput[],
) {
  assert.match(
    pageSource,
    /import \{[\s\S]*?FieldLabel,[\s\S]*?FormField,[\s\S]*?\} from "@\/components\/ui\/form-field"/,
    `${pageName} must use the shared field composition`,
  );
  assert.match(
    pageSource,
    /import \{ Input \} from "@\/components\/ui\/input"/,
    `${pageName} must use the shared input primitive`,
  );

  const inputs = pageSource.match(/<Input\b[\s\S]*?\/>/g) ?? [];
  assert.equal(
    inputs.length,
    expected.length,
    `${pageName} must keep one canonical Input per text field`,
  );

  for (const contract of expected) {
    const input = inputs.find((candidate) =>
      candidate.includes(`id="${contract.id}"`),
    );
    assert.ok(input, `${pageName} is missing #${contract.id}`);
    assert.match(input, new RegExp(`name="${contract.name}"`));
    assert.match(input, new RegExp(`autoComplete="${contract.autoComplete}"`));
    assert.match(input, /\brequired\b/);
    assert.match(input, new RegExp(`maxLength=\\{${contract.maxLength}\\}`));
    if (contract.minLength !== undefined) {
      assert.match(input, new RegExp(`minLength=\\{${contract.minLength}\\}`));
    } else {
      assert.doesNotMatch(input, /\bminLength=/);
    }
  }

  assert.doesNotMatch(pageSource, /<(?:input|label)\b/);
  assert.doesNotMatch(
    pageSource,
    /\b(?:ProductShell|PageHero|StatusMessage)\b|\b(?:field-input|primary-form-card|product-hero-card)\b/,
    `${pageName} must not reintroduce the retired Auth form or hero layers`,
  );
}

test("Auth fields use one shared, explicit input contract", () => {
  const login = source("src/components/auth/login-form.tsx");
  const join = source("src/app/(auth)/(entry)/join/page.tsx");
  const forgotPassword = source("src/app/(auth)/forgot-password/page.tsx");
  const resetPassword = source("src/app/(auth)/reset-password/page.tsx");

  assertCanonicalAuthInputs("login", login, [
    {
      id: "login-identifier",
      name: "identifier",
      autoComplete: "username",
      maxLength: 254,
    },
    {
      id: "login-secret",
      name: "secret",
      autoComplete: "current-password",
      maxLength: 256,
    },
  ]);
  assertCanonicalAuthInputs("join", join, [
    {
      id: "join-name",
      name: "name",
      autoComplete: "name",
      maxLength: 160,
    },
    {
      id: "join-email",
      name: "email",
      autoComplete: "email",
      maxLength: 254,
    },
    {
      id: "join-password",
      name: "password",
      autoComplete: "new-password",
      minLength: 8,
      maxLength: 256,
    },
    {
      id: "join-confirm-password",
      name: "confirmPassword",
      autoComplete: "new-password",
      minLength: 8,
      maxLength: 256,
    },
  ]);
  assertCanonicalAuthInputs("forgot password", forgotPassword, [
    {
      id: "recovery-email",
      name: "email",
      autoComplete: "email",
      maxLength: 254,
    },
  ]);
  assertCanonicalAuthInputs("reset password", resetPassword, [
    {
      id: "reset-password",
      name: "password",
      autoComplete: "new-password",
      minLength: 8,
      maxLength: 256,
    },
    {
      id: "reset-confirm-password",
      name: "confirmPassword",
      autoComplete: "new-password",
      minLength: 8,
      maxLength: 256,
    },
  ]);

  assert.equal((login.match(/<FormField>/g) ?? []).length, 2);
  assert.equal((join.match(/<FormField>/g) ?? []).length, 5);
  assert.equal((forgotPassword.match(/<FormField>/g) ?? []).length, 1);
  assert.equal((resetPassword.match(/<FormField>/g) ?? []).length, 2);
});
