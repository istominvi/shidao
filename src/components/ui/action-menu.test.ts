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

test("action menu keeps stable trigger defaults and exposes explicit compact sizing", () => {
  assert.match(actionMenuSource, /triggerIcon: TriggerIcon = MoreHorizontal/);
  assert.match(actionMenuSource, /triggerVariant = "secondary"/);
  assert.match(actionMenuSource, /triggerSize = "default"/);
  assert.match(actionMenuSource, /portal = false/);
  assert.match(actionMenuSource, /productButtonClassName\(\s*triggerVariant/);
  assert.match(
    actionMenuSource,
    /data-trigger-size=\{triggerSize === "compact" \? "compact" : undefined\}/,
  );
  assert.doesNotMatch(actionMenuSource, /action-menu-trigger px-3/);
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
  const rootStyles = /:root\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";
  const dropdownStyles =
    /\.product-dropdown-surface\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";
  const actionPanelStyles =
    /\.action-menu-panel\s*\{[^}]*\}/.exec(styles)?.[0] ?? "";
  const forcedColorsStart = styles.indexOf("@media (forced-colors: active)");
  const forcedColorsEnd = styles.indexOf(
    ".course-action-inline-error",
    forcedColorsStart,
  );
  const forcedColorsStyles = styles.slice(forcedColorsStart, forcedColorsEnd);

  assert.match(
    rootStyles,
    /--product-surface-background: #fff;[^}]*--product-surface-border-width: 1px;[^}]*--product-surface-border-color: oklch\(0 0 0 \/ 0\.1\);[^}]*--product-surface-border:\s*var\(--product-surface-border-width\) solid\s*var\(--product-surface-border-color\);[^}]*--product-dropdown-background: var\(--product-surface-background\);[^}]*--product-dropdown-radius: var\(--product-element-radius\);[^}]*--product-dropdown-inset: 0\.375rem;[^}]*--product-dropdown-shadow: 0 24px 32px -24px rgba\(20, 20, 20, 0\.24\);/,
  );
  assert.doesNotMatch(
    rootStyles,
    /--product-context-menu-(?:surface|radius|inset|shadow)/,
  );
  assert.match(dropdownStyles, /border: 0;/);
  assert.match(
    dropdownStyles,
    /border-radius: var\(\s*--product-dropdown-radius,\s*var\(--product-element-radius, 0\.75rem\)\s*\);/,
  );
  assert.match(
    dropdownStyles,
    /background: var\(--product-dropdown-background, #fff\);/,
  );
  assert.match(
    dropdownStyles,
    /padding: var\(--product-dropdown-inset, 0\.375rem\);/,
  );
  assert.match(
    dropdownStyles,
    /box-shadow: var\(\s*--product-dropdown-shadow,\s*0 24px 32px -24px rgba\(20, 20, 20, 0\.24\)\s*\);/,
  );
  assert.equal(dropdownStyles.match(/box-shadow:/g)?.length, 1);
  assert.match(dropdownStyles, /backdrop-filter: none;/);
  assert.doesNotMatch(dropdownStyles, /\bblur\(|box-shadow:[^;]*\binset\b/);
  assert.match(
    actionMenuSource,
    /className=\{classNames\(\s*"product-dropdown-surface",\s*"action-menu-panel"/,
  );
  assert.doesNotMatch(
    actionPanelStyles,
    /border(?:-radius)?:|background:|padding:|box-shadow:|backdrop-filter:/,
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
    styles,
    /\.action-menu-root\[data-trigger-size="compact"\][\s\S]*?> \.product-btn\.action-menu-trigger\s*\{[^}]*width: var\(--product-inner-control-size, 2rem\);[^}]*height: var\(--product-inner-control-size, 2rem\);[^}]*border: 0;[^}]*border-radius: var\(--product-inner-control-radius, 0\.5rem\);/,
  );
  for (const consumer of actionMenuConsumers) {
    assert.match(consumer, /triggerSize="compact"|triggerSize=\{/);
    assert.doesNotMatch(
      consumer,
      /(?:course-index-table|teaching-run|student-directory)-action-menu/,
    );
  }
  assert.match(
    forcedColorsStyles,
    /\.product-dropdown-surface\s*\{[^}]*border: 1px solid CanvasText;[^}]*background: Canvas;[^}]*box-shadow: none;/,
  );
  assert.match(
    forcedColorsStyles,
    /\.nav-dropdown-item:focus-visible,\s*\.action-menu-item:focus-visible\s*\{[^}]*outline: 2px solid Highlight;[^}]*outline-offset: -2px;[^}]*box-shadow: none;/,
  );
});
