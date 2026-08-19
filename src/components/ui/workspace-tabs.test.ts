import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("workspace tabs keep their accessible visual contract and raise positive counts", () => {
  const component = source("src/components/ui/workspace-tabs.tsx");
  const fadeControl = source("src/components/ui/fade-chevron-button.tsx");
  const styles = source("src/app/globals.css");
  const motionStyles = source("src/app/styles/page-motion.css");
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
    component,
    /className=\{classNames\("workspace-tabs-rail", className\)\}/,
  );
  assert.match(
    component,
    /className="workspace-tabs-scroll"[\s\S]*?onScroll=\{updateScrollEdges\}/,
  );
  assert.match(component, /aria-label="Прокрутить вкладки влево"/);
  assert.match(component, /aria-label="Прокрутить вкладки вправо"/);
  assert.match(component, /hidden=\{!scrollEdges\.canScrollLeft\}/);
  assert.match(component, /hidden=\{!scrollEdges\.canScrollRight\}/);
  assert.match(
    component,
    /<FadeChevronButton[\s\S]*?direction="left"[\s\S]*?role="tablist"[\s\S]*?<FadeChevronButton[\s\S]*?direction="right"/,
  );
  assert.match(fadeControl, /"fade-chevron-control"/);
  assert.match(
    fadeControl,
    /direction === "left" \? ChevronLeft : ChevronRight/,
  );
  assert.match(component, /scroller\.scrollBy\(\{/);
  assert.match(component, /behavior: reducedMotion \? "auto" : "smooth"/);
  assert.match(component, /document\.activeElement === leftScrollControlRef/);
  assert.match(component, /document\.activeElement === rightScrollControlRef/);
  assert.match(component, /const focusTarget = nextControl \?\? tabRefs/);

  assert.match(
    styles,
    /\.workspace-tabs\s*\{[^}]*--workspace-tabs-inline-offset: 0px;[^}]*padding-inline: var\(--workspace-tabs-inline-offset\);/,
  );
  assert.match(
    component,
    /const leftEdgePadding =[\s\S]*?SCROLL_CONTROL_REVEAL_PADDING/,
  );
  assert.match(
    component,
    /const rightEdgePadding =[\s\S]*?SCROLL_CONTROL_REVEAL_PADDING/,
  );
  assert.match(
    styles,
    /\.workspace-tabs-scroll\s*\{[^}]*overflow-x: auto;[^}]*scrollbar-width: none;[^}]*-ms-overflow-style: none;/,
  );
  assert.match(
    styles,
    /\.workspace-tabs-scroll::\-webkit-scrollbar\s*\{[^}]*display: none;[^}]*width: 0;[^}]*height: 0;/,
  );
  assert.match(
    styles,
    /\.workspace-tabs-rail\[data-can-scroll-left="true"\]\[data-can-scroll-right="true"\][\s\S]*?mask-image: linear-gradient/,
  );
  assert.match(
    styles,
    /\.workspace-tabs-scroll-control\s*\{[^}]*position: absolute;/,
  );
  assert.match(
    styles,
    /\.fade-chevron-control\s*\{[^}]*width: var\(--product-control-height, 2\.5rem\);[^}]*height: var\(--product-control-height, 2\.5rem\);[^}]*border: 0;[^}]*radial-gradient/,
  );
  assert.match(
    styles,
    /\.workspace-tabs-scroll-control\[hidden\]\s*\{[^}]*display: none;/,
  );
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-selection-motion-duration: 360ms;[^}]*--product-selection-motion-easing: cubic-bezier\(0\.22, 1, 0\.36, 1\);[^}]*--product-selection-motion-fade-duration: 120ms;[^}]*--product-secondary-foreground: oklch\(0\.19 0 0 \/ 0\.6\);[^}]*--product-workspace-tabs-divider-color: oklch\(0\.19 0 0 \/ 0\.4\);/,
  );
  assert.match(
    styles,
    /\.workspace-tabs::before\s*\{[^}]*right: var\(--workspace-tabs-inline-offset\);[^}]*left: var\(--workspace-tabs-inline-offset\);/,
  );
  assert.match(styles, /\.workspace-tabs\s*\{[^}]*gap: 0\.75rem;/);
  assert.match(
    styles,
    /\.workspace-tabs::before\s*\{[^}]*z-index: 1;[^}]*bottom: 0;[^}]*height: 3px;[^}]*background: var\(--product-workspace-tabs-divider-color\);[^}]*transform: scaleY\(0\.4\);[^}]*transform-origin: center bottom;[^}]*pointer-events: none;/,
  );
  assert.match(
    styles,
    /\.workspace-tab\s*\{[^}]*border-radius: var\(--product-control-radius, 0\.75rem\)[^}]*0 0;[^}]*color: var\(--product-secondary-foreground\);/,
  );
  assert.match(styles, /\.workspace-tab\s*\{[^}]*font-weight: 500;/);
  assert.match(
    styles,
    /\.app-page-shell \.workspace-tab\s*\{[^}]*font-weight: var\(--product-control-font-weight\);/,
  );
  assert.match(component, /className="workspace-tabs-indicator"/);
  assert.match(component, /activeTab\.getBoundingClientRect\(\)/);
  assert.match(component, /left: activeTabRect\.left - tabsRect\.left/);
  assert.match(component, /width: activeTabRect\.width/);
  assert.match(component, /new ResizeObserver\(updateLayout\)/);
  assert.match(component, /observer\.observe\(scroller\)/);
  assert.match(component, /updateScrollEdges\(\)/);
  assert.match(component, /data-indicator-ready=\{indicator\.ready/);
  assert.match(component, /indicator\.ready && indicatorMotionReady/);
  assert.match(component, /panel\.animate\(/);
  assert.doesNotMatch(component, /panelAnimationFrameRef/);
  assert.match(component, /animation\.finished/);
  assert.match(component, /duration: 260/);
  assert.match(component, /prefers-reduced-motion: reduce/);
  assert.match(component, /directionOverride/);
  assert.match(component, /event\.key === "ArrowRight"[\s\S]*?"forward"/);
  assert.match(component, /event\.key === "ArrowLeft"[\s\S]*?"back"/);
  assert.match(
    motionStyles,
    /\.workspace-tabs-indicator\s*\{[^}]*height: 4px;[^}]*background: #141414;[^}]*transition: none;/,
  );
  assert.match(
    motionStyles,
    /\.workspace-tabs-indicator\[data-motion-ready="true"\]\s*\{[^}]*transition:[^}]*width var\(--product-selection-motion-duration\)\s*var\(--product-selection-motion-easing\),[^}]*transform var\(--product-selection-motion-duration\)\s*var\(--product-selection-motion-easing\),[^}]*opacity var\(--product-selection-motion-fade-duration\) ease;/,
  );
  assert.match(
    motionStyles,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.workspace-tabs-indicator,\s*\.workspace-tabs-indicator\[data-motion-ready="true"\]\s*\{[^}]*transition: none;/,
  );
  assert.match(
    motionStyles,
    /\.workspace-tabs\[data-indicator-ready="true"\] \.workspace-tab-active::after\s*\{[^}]*display: none;/,
  );
  assert.match(
    styles,
    /\.workspace-tab-icon\s*\{[^}]*width: 1rem;[^}]*height: 1rem;[^}]*color: currentColor;[^}]*opacity: 1;/,
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
      values: ["profile", "history", "attestation", "observers", "settings"],
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
