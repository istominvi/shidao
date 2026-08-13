import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("workspace tabs keep their accessible visual contract and raise positive counts", () => {
  const component = source("src/components/ui/workspace-tabs.tsx");
  const styles = source("src/app/globals.css");
  const countStyles = /\.workspace-tab-count\s*\{[^}]*\}/.exec(styles)?.[0];

  assert.match(component, /role="tablist"/);
  assert.match(component, /role="tab"/);
  assert.match(component, /aria-selected=\{active\}/);
  assert.match(component, /aria-controls=\{workspaceTabPanelId/);
  assert.match(component, /icon: LucideIcon;/);
  assert.match(
    component,
    /<Icon className="workspace-tab-icon" aria-hidden="true" \/>/,
  );
  assert.match(component, /typeof item\.count === "number" && item\.count > 0/);
  assert.match(
    component,
    /\{" "\}[\s\S]*?<sup className="workspace-tab-count">\{item\.count\}<\/sup>/,
  );

  assert.match(
    styles,
    /\.workspace-tabs\s*\{[^}]*--workspace-tabs-inline-offset: 0px;[^}]*padding-inline: var\(--workspace-tabs-inline-offset\);/,
  );
  assert.match(component, /const edgePadding = 0;/);
  assert.match(
    styles,
    /\.workspace-tabs::before\s*\{[^}]*right: var\(--workspace-tabs-inline-offset\);[^}]*left: var\(--workspace-tabs-inline-offset\);/,
  );
  assert.match(styles, /\.workspace-tabs\s*\{[^}]*gap: 0\.75rem;/);
  assert.match(
    styles,
    /\.workspace-tabs::before\s*\{[^}]*z-index: 1;[^}]*bottom: 0;[^}]*height: 3px;[^}]*background: var\(--product-muted-foreground\);[^}]*transform: scaleY\(0\.5\);[^}]*transform-origin: center bottom;[^}]*pointer-events: none;/,
  );
  assert.match(
    styles,
    /\.workspace-tab\s*\{[^}]*border-radius: var\(--course-demo-control-radius, 0\.75rem\)[^}]*0 0;[^}]*color: var\(--product-muted-foreground\);/,
  );
  assert.match(
    styles,
    /\.workspace-tab-active::after\s*\{[^}]*z-index: 2;[^}]*height: 4px;[^}]*background: #141414;/,
  );
  assert.ok(countStyles, "Count styles must remain discoverable");
  assert.match(countStyles, /display: inline;/);
  assert.match(countStyles, /position: relative;/);
  assert.match(countStyles, /top: -0\.4em;/);
  assert.match(countStyles, /color: inherit;/);
  assert.match(countStyles, /font-size: 0\.7em;/);
  assert.match(countStyles, /font-weight: 500;/);
  assert.match(countStyles, /line-height: 0;/);
  assert.match(countStyles, /vertical-align: baseline;/);
  assert.doesNotMatch(
    countStyles,
    /min-width|place-items|border-radius|background|padding/,
  );
});

test("identity workspace tabs keep persistent owned tab panels", () => {
  const consumers = [
    {
      component: source(
        "src/components/learner-identity/learning-profile-workspace.tsx",
      ),
      idConstant: "LEARNING_PROFILE_TABS_ID",
      values: ["overview", "history", "attestation", "access", "data"],
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
