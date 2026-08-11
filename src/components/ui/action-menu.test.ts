import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionMenuSource = readFileSync(
  "src/components/ui/action-menu.tsx",
  "utf8",
);

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
