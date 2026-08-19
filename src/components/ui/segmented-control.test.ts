import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const component = source("src/components/ui/segmented-control.tsx");
const styles = source("src/app/globals.css");
const motionStyles = source("src/app/styles/page-motion.css");

test("segmented control keeps one measured indicator and semantic button state", () => {
  assert.match(component, /^"use client";/);
  assert.match(component, /const groupRef = useRef<HTMLDivElement>\(null\);/);
  assert.match(
    component,
    /const optionRefs = useRef\(new Map<T, HTMLButtonElement>\(\)\);/,
  );
  assert.match(component, /ref=\{groupRef\}/);
  assert.match(component, /role="group"/);
  assert.match(component, /aria-label=\{ariaLabel\}/);
  assert.match(component, /data-variant=\{iconOnly \? "icon" : "text"\}/);
  assert.match(
    component,
    /className=\{classNames\("product-segmented-control", className\)\}/,
  );
  assert.match(component, /aria-pressed=\{isSelected\}/);
  assert.match(component, /className="product-segmented-control-option"/);
  assert.match(component, /className="product-segmented-control-option-label"/);
  assert.doesNotMatch(
    component,
    /product-segmented-control-(?:icon-only|text|option-icon-only|option-selected)/,
  );

  assert.equal(
    component.match(/className="product-segmented-control-indicator"/g)?.length,
    1,
  );
  assert.ok(
    component.indexOf('className="product-segmented-control-indicator"') <
      component.indexOf("{items.map"),
    "The visual indicator must precede every semantic option",
  );
  assert.match(
    component,
    /data-indicator-ready=\{indicatorVisible \|\| undefined\}/,
  );
  assert.match(
    component,
    /width: `\$\{indicator\.width\}px`,\s*transform: `translate3d\(\$\{indicator\.left\}px, 0, 0\)`,/,
  );
});

test("segmented indicator fails closed and tracks every resize path", () => {
  assert.match(
    component,
    /if \(!group \|\| !selectedOption\) \{[\s\S]*?current\.ready\s*\? \{ left: 0, width: 0, ready: false \}\s*: current/,
  );
  assert.match(
    component,
    /if \(selectedRect\.width <= 0 \|\| selectedRect\.height <= 0\) \{[\s\S]*?current\.ready\s*\? \{ left: 0, width: 0, ready: false \}\s*: current/,
  );
  assert.match(
    component,
    /left: selectedRect\.left - groupRect\.left - group\.clientLeft/,
  );
  assert.match(component, /width: selectedRect\.width/);
  assert.match(
    component,
    /if \(typeof ResizeObserver === "undefined"\) \{\s*window\.addEventListener\("resize", updateIndicator\);\s*return \(\) => window\.removeEventListener\("resize", updateIndicator\);\s*\}/,
  );
  assert.match(
    component,
    /const observer = new ResizeObserver\(updateIndicator\)/,
  );
  assert.match(component, /observer\.observe\(group\)/);
  assert.match(
    component,
    /for \(const option of optionRefs\.current\.values\(\)\) observer\.observe\(option\)/,
  );
  assert.equal(component.match(/window\.requestAnimationFrame\(/g)?.length, 1);
  assert.equal(component.match(/window\.cancelAnimationFrame\(/g)?.length, 1);
});

test("segmented CSS expresses variants and selection without modifier classes", () => {
  assert.match(
    styles,
    /--product-segmented-control-height: var\(--product-control-height\);[\s\S]*?--product-segmented-control-option-size: calc\(/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\s*\{[^}]*--segmented-option-width: auto;[^}]*--segmented-option-min-width: var\(--product-segmented-control-option-size\);[^}]*--segmented-option-flex: 0 0 auto;[^}]*height: var\(--product-segmented-control-height\);[^}]*gap: var\(--product-segmented-control-gap\);[^}]*border: var\(--product-surface-border\);/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-variant="icon"\]\s*\{[^}]*--segmented-option-width: var\(--product-segmented-control-option-size\);[^}]*--segmented-option-flex: 0 0 var\(--product-segmented-control-option-size\);[^}]*--segmented-option-padding-inline: 0;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-option\s*\{[^}]*width: var\(--segmented-option-width\);[^}]*height: var\(--product-segmented-control-option-size\);[^}]*min-width: var\(--segmented-option-min-width\);[^}]*flex: var\(--segmented-option-flex\);[^}]*padding-inline: var\(--segmented-option-padding-inline\);/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-option\[aria-pressed="true"\]\s*\{[^}]*background: var\(--segmented-selected-background\);[^}]*background-clip: var\(--segmented-selected-background-clip\);[^}]*box-shadow: var\(--segmented-selected-shadow\);/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-indicator-ready="true"\]\s*\{[^}]*--segmented-selected-background: transparent;[^}]*--segmented-selected-background-clip: border-box;[^}]*--segmented-selected-shadow: none;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-indicator-ready="true"\]:has\([\s\S]*?\)\s*\.product-segmented-control-indicator\s*\{[^}]*box-shadow: var\(--product-segmented-control-surface-shadow-pressed\);/,
  );
  assert.match(
    styles,
    /\.app-page-shell \.product-segmented-control\[data-variant="text"\]\s*\{[^}]*--segmented-option-min-width: 0;[^}]*--segmented-option-flex: 1 1 0;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-variant="text"\][\s\S]*?> \.product-segmented-control-option\s*> \.product-segmented-control-option-label\s*\{[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/,
  );
  assert.doesNotMatch(
    styles,
    /product-segmented-control-(?:icon-only|text|option-icon-only|option-selected)/,
  );

  const optionRule =
    /\.product-segmented-control-option\s*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.doesNotMatch(optionRule, /box-sizing|min-height|transform:\s*none/);
  assert.doesNotMatch(
    styles,
    /\.product-segmented-control(?:::before|[^\s,{]*::before)/,
  );
});

test("segmented and workspace indicators share motion and accessibility fallbacks", () => {
  assert.match(
    styles,
    /--product-selection-motion-duration: 360ms;[^}]*--product-selection-motion-easing: cubic-bezier\(0\.22, 1, 0\.36, 1\);[^}]*--product-selection-motion-fade-duration: 120ms;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-indicator\[data-motion-ready="true"\]\s*\{[^}]*width var\(--product-selection-motion-duration\)[^}]*transform var\(--product-selection-motion-duration\)[^}]*opacity var\(--product-selection-motion-fade-duration\) ease;/,
  );
  assert.match(
    motionStyles,
    /\.workspace-tabs-indicator\[data-motion-ready="true"\]\s*\{[^}]*width var\(--product-selection-motion-duration\)[^}]*transform var\(--product-selection-motion-duration\)[^}]*opacity var\(--product-selection-motion-fade-duration\) ease;/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.product-segmented-control-indicator,[\s\S]*?transition: none;/,
  );
  assert.match(
    styles,
    /@media \(forced-colors: active\)[\s\S]*?\.product-segmented-control-indicator\s*\{[^}]*display: none !important;[\s\S]*?\.product-segmented-control-option\[aria-pressed="true"\]\s*\{[^}]*background: Highlight !important;[^}]*color: HighlightText !important;/,
  );
});
