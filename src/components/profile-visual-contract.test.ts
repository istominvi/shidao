import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("all profile tabs use the same opaque 20px content-card contract", () => {
  const styles = source("src/components/profile/profile-workspace.module.css");
  const profileSurface = source("src/components/profile/profile-surface.tsx");
  const workspace = source(
    "src/components/learner-identity/learning-profile-workspace.tsx",
  );
  const observers = source(
    "src/components/learner-identity/observers-settings-workspace.tsx",
  );
  const accountSettings = source(
    "src/components/account/account-settings-panel.tsx",
  );
  const security = source(
    "src/app/(app)/settings/security/security-settings-form.tsx",
  );
  const progress = source(
    "src/components/learner-identity/progress-summary.tsx",
  );
  const history = source(
    "src/components/learner-identity/safe-history-list.tsx",
  );
  const shareCode = source(
    "src/components/learner-identity/share-code-card.tsx",
  );
  const identityUi = source("src/components/learner-identity/identity-ui.tsx");

  assert.match(
    styles,
    /--profile-content-card-radius: var\(--product-card-radius, 1\.25rem\)/,
  );
  assert.match(
    styles,
    /\.card\.card,[\s\S]*border: var\([\s\S]*--product-surface-border,[\s\S]*1px solid oklch\(0 0 0 \/ 0\.1\)/,
  );
  assert.match(
    styles,
    /border-radius: var\([\s\S]*--product-card-radius, 1\.25rem/,
  );
  assert.match(styles, /background: #fff/);
  assert.match(styles, /box-shadow: var\(--product-raised-surface-shadow\)/);
  assert.match(styles, /--profile-content-card-padding: 1\.25rem/);
  assert.match(styles, /\.row\.row[\s\S]*box-shadow: none/);
  assert.match(
    styles,
    /\.workspace \[data-profile-surface="table"\][\s\S]*--profile-content-card-radius[\s\S]*background: #fff[\s\S]*box-shadow: var\(--product-raised-surface-shadow\)/,
  );
  assert.doesNotMatch(styles, /:global/);

  assert.match(workspace, /profileStyles\.workspace/);
  assert.match(profileSurface, /classNames\(styles\.card, className\)/);
  assert.match(profileSurface, /data-profile-surface="card"/);

  for (const panel of [workspace, observers, accountSettings]) {
    assert.match(panel, /<ProfileSurface/);
  }
  for (const panel of [workspace, observers, security]) {
    assert.match(panel, /data-profile-surface="row"/);
  }
  for (const panel of [workspace, observers, accountSettings, security]) {
    assert.doesNotMatch(
      panel,
      /rounded-(?:2xl|3xl)[^"\n]*border[^"\n]*bg-white/,
    );
  }

  for (const cardSource of [history]) {
    assert.match(cardSource, /data-profile-surface="card"/);
    assert.doesNotMatch(
      cardSource,
      /rounded-(?:2xl|3xl)[^"\n]*border[^"\n]*bg-white/,
    );
  }
  assert.match(progress, /className=\{profileStyles\.card\}/);
  assert.match(progress, /data-profile-surface="card"/);
  assert.match(shareCode, /data-profile-surface="card"/);
  assert.match(progress, /data-profile-surface="table"/);
  assert.match(
    progress,
    /className="product-table-wrap overflow-x-auto rounded-2xl border border-neutral-200 bg-white"/,
  );
  assert.match(identityUi, /surface\?: "card" \| "row"/);
  assert.match(identityUi, /data-profile-surface=\{surface\}/);
  assert.match(progress, /<IdentityEmpty[\s\S]*surface="card"/);
  assert.match(history, /<IdentityEmpty[\s\S]*surface="card"/);
  assert.match(workspace, /<IdentityEmpty[\s\S]*surface="row"/);
  assert.match(observers, /<IdentityEmpty[\s\S]*surface="row"/);

  assert.doesNotMatch(workspace, /bg-(?:amber|rose)-50 p-5/);
  assert.doesNotMatch(accountSettings, /mb-2 block text-sm font-medium/);
  assert.doesNotMatch(security, /mb-2 block text-sm font-medium/);
});

test("profile-facing copy describes the whole profile section", () => {
  const workspace = source(
    "src/components/learner-identity/learning-profile-workspace.tsx",
  );

  assert.match(workspace, /title="Учебная информация"/);
  assert.match(workspace, /Загружаем профиль…/);
  assert.doesNotMatch(workspace, /Загружаем учебный профиль/);
  assert.doesNotMatch(workspace, /Не удалось загрузить учебный профиль/);
});
