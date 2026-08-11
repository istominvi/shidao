import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("workspace tabs keep their accessible tab contract and render counts as inline text", () => {
  const component = source("src/components/ui/workspace-tabs.tsx");
  const styles = source("src/app/globals.css");
  const countStyles = /\.workspace-tab-count\s*\{[^}]*\}/.exec(styles)?.[0];

  assert.match(component, /role="tablist"/);
  assert.match(component, /role="tab"/);
  assert.match(component, /aria-selected=\{active\}/);
  assert.match(component, /aria-controls=\{workspaceTabPanelId/);
  assert.match(
    component,
    /<span className="workspace-tab-label">[\s\S]*?\{item\.label\}[\s\S]*?<span className="workspace-tab-count">\{` \$\{item\.count\}`\}<\/span>/,
  );

  assert.match(
    styles,
    /\.workspace-tabs::before\s*\{[^}]*height: 1px;[^}]*background: rgba\(20, 20, 20, 0\.2\);/,
  );
  assert.match(
    styles,
    /\.workspace-tab-active::after\s*\{[^}]*height: 4px;[^}]*background: #141414;/,
  );
  assert.ok(countStyles, "Count styles must remain discoverable");
  assert.match(countStyles, /display: inline;/);
  assert.match(countStyles, /color: inherit;/);
  assert.match(countStyles, /font: inherit;/);
  assert.doesNotMatch(
    countStyles,
    /min-width|height|place-items|border-radius|background|padding/,
  );
});

test("identity workspace tabs keep persistent owned tab panels", () => {
  const consumers = [
    {
      component: source(
        "src/components/learner-identity/learning-profile-workspace.tsx",
      ),
      idConstant: "LEARNING_PROFILE_TABS_ID",
      values: ["overview", "history", "access", "data"],
    },
    {
      component: source(
        "src/components/learner-identity/observing-workspace.tsx",
      ),
      idConstant: "OBSERVING_PROJECTION_TABS_ID",
      values: ["progress", "history"],
    },
  ] as const;

  for (const { component, idConstant, values } of consumers) {
    assert.match(component, new RegExp(`idBase=\\{${idConstant}\\}`));
    assert.equal(component.match(/role="tabpanel"/g)?.length, values.length);
    assert.equal(component.match(/tabIndex=\{0\}/g)?.length, values.length);

    for (const value of values) {
      const helperArguments = `\\(\\s*${idConstant},\\s*"${value}",?\\s*\\)`;
      assert.match(
        component,
        new RegExp(`id=\\{workspaceTabPanelId${helperArguments}\\}`),
      );
      assert.match(
        component,
        new RegExp(`aria-labelledby=\\{workspaceTabId${helperArguments}\\}`),
      );
      assert.match(
        component,
        new RegExp(`hidden=\\{surface !== "${value}"\\}`),
      );
    }
  }
});
