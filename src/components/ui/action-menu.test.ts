import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionMenuSource = readFileSync(
  "src/components/ui/action-menu.tsx",
  "utf8",
);
const styles = readFileSync("src/app/globals.css", "utf8");
const actionMenuConsumers = [
  "src/components/course-builder/course-actions.tsx",
  "src/components/teaching-hub/schedule-workspace.tsx",
  "src/components/teaching-hub/student-directory-table.tsx",
].map((path) => readFileSync(path, "utf8"));

test("action menu keeps legacy trigger defaults and exposes optional schedule controls", () => {
  assert.match(actionMenuSource, /triggerIcon: TriggerIcon = MoreHorizontal/);
  assert.match(actionMenuSource, /triggerVariant = "secondary"/);
  assert.match(actionMenuSource, /portal = false/);
  assert.match(actionMenuSource, /productButtonClassName\(\s*triggerVariant/);
  assert.match(actionMenuSource, /<TriggerIcon/);
});

test("portal action menus escape overflow while preserving interaction boundaries", () => {
  assert.match(actionMenuSource, /createPortal\(menu, document\.body\)/);
  assert.match(actionMenuSource, /position: "fixed"/);
  assert.match(actionMenuSource, /triggerRect\.right - menuWidth/);
  assert.match(actionMenuSource, /PORTAL_VIEWPORT_MARGIN/);
  assert.match(
    actionMenuSource,
    /window\.addEventListener\("scroll", updatePortalPosition, true\)/,
  );
  assert.match(
    actionMenuSource,
    /window\.addEventListener\("resize", updatePortalPosition\)/,
  );
  assert.match(actionMenuSource, /rootNode\?\.contains\(target\)/);
  assert.match(actionMenuSource, /menuNode\?\.contains\(target\)/);
  assert.match(actionMenuSource, /closeMenu\(\)/);
  assert.match(actionMenuSource, /focusItem\(nextIndex\)/);
});

test("contextual action menus use one borderless surface without separators", () => {
  const forcedColorsStyles =
    /@media \(forced-colors: active\)\s*\{[\s\S]*?\.action-menu-item:focus-visible\s*\{[^}]*\}\s*\}/.exec(
      styles,
    )?.[0] ?? "";

  assert.match(
    styles,
    /:root\s*\{[^}]*--product-context-menu-surface: #fff;[^}]*--product-context-menu-radius: var\(--product-element-radius\);[^}]*--product-context-menu-shadow: 0 18px 46px rgba\(20, 20, 20, 0\.18\);/,
  );
  assert.match(
    styles,
    /\.action-menu-panel\s*\{[^}]*border: 0;[^}]*border-radius: var\([^}]*--product-context-menu-radius,[^}]*background: var\(--product-context-menu-surface, #fff\);[^}]*box-shadow: var\([^}]*--product-context-menu-shadow,[^}]*0 18px 46px rgba\(20, 20, 20, 0\.18\)[^}]*\);/,
  );
  assert.doesNotMatch(styles, /\.action-menu-separator/);
  assert.doesNotMatch(
    actionMenuSource,
    /separatorBefore|action-menu-separator|role="separator"/,
  );
  for (const consumer of actionMenuConsumers) {
    assert.doesNotMatch(consumer, /separatorBefore/);
  }
  assert.match(
    forcedColorsStyles,
    /\.action-menu-panel\s*\{[^}]*border: 1px solid CanvasText;[^}]*box-shadow: none;[^}]*\}\s*\.action-menu-item:focus-visible\s*\{[^}]*outline: 2px solid Highlight;[^}]*outline-offset: -2px;/,
  );
});
