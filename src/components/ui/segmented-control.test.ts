import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const component = source("src/components/ui/segmented-control.tsx");
const styles = source("src/app/globals.css");
const motionStyles = source("src/app/styles/page-motion.css");

test("segmented control owns one measured indicator before its buttons", () => {
  assert.match(component, /^"use client";/);
  assert.match(component, /const groupRef = useRef<HTMLDivElement>\(null\);/);
  assert.match(
    component,
    /const optionRefs = useRef\(new Map<T, HTMLButtonElement>\(\)\);/,
  );
  assert.match(component, /ref=\{groupRef\}/);
  assert.match(
    component,
    /ref=\{\(node\) => \{\s*if \(node\) optionRefs\.current\.set\(item\.value, node\);\s*else optionRefs\.current\.delete\(item\.value\);\s*\}\}/,
  );

  assert.equal(
    component.match(/className="product-segmented-control-indicator"/g)?.length,
    1,
  );
  assert.ok(
    component.indexOf('className="product-segmented-control-indicator"') <
      component.indexOf("{items.map"),
    "The single visual indicator must precede every semantic button",
  );
  assert.match(
    component,
    /<span\s+className="product-segmented-control-indicator"\s+aria-hidden="true"\s+data-ready=\{indicatorVisible \|\| undefined\}\s+data-motion-ready=/,
  );
  assert.match(
    component,
    /data-indicator-ready=\{indicatorVisible \|\| undefined\}/,
  );
  assert.match(
    component,
    /width: `\$\{indicator\.width\}px`,\s*transform: `translate3d\(\$\{indicator\.left\}px, 0, 0\)`,/,
  );
  assert.match(component, /aria-pressed=\{isSelected\}/);
});

test("segmented indicator measurement fails closed and tracks every resize path", () => {
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
  assert.match(component, /return \(\) => observer\.disconnect\(\)/);

  assert.equal(component.match(/window\.requestAnimationFrame\(/g)?.length, 1);
  assert.equal(component.match(/window\.cancelAnimationFrame\(/g)?.length, 1);
  assert.match(
    component,
    /const indicatorVisible =\s*indicator\.ready &&\s*selectedItem !== undefined &&\s*!\(disabled \|\| selectedItem\.disabled\);[\s\S]*?if \(!indicatorVisible\) \{\s*setIndicatorMotionReady\(false\);\s*return;\s*\}[\s\S]*?const frame = window\.requestAnimationFrame\(\(\) =>\s*setIndicatorMotionReady\(true\),\s*\);\s*return \(\) => window\.cancelAnimationFrame\(frame\);[\s\S]*?\}, \[indicatorVisible\]\);/,
  );
});

test("segmented indicator preserves canonical geometry and owns selected elevation", () => {
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-element-radius: 0\.75rem;[^}]*--product-control-radius: var\(--product-element-radius\);[^}]*--product-surface-background: #fff;[^}]*--product-surface-border-width: 1px;/,
  );
  assert.match(
    styles,
    /:root\s*\{[\s\S]*?--product-segmented-control-height: var\(--product-control-height\);[\s\S]*?--product-segmented-control-radius: var\(--product-control-radius\);[\s\S]*?--product-segmented-control-option-size: calc\(\s*var\(--product-segmented-control-height\) -\s*var\(--product-surface-border-width\) - var\(--product-surface-border-width\)\s*\);[\s\S]*?--product-segmented-control-option-radius: calc\(\s*var\(--product-segmented-control-radius\) -\s*var\(--product-surface-border-width\)\s*\);[\s\S]*?--product-segmented-control-gap: calc\(\s*var\(--product-surface-border-width\) \+ var\(--product-surface-border-width\)\s*\);/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\s*\{[^}]*position: relative;[^}]*box-sizing: border-box;[^}]*height: var\(--product-segmented-control-height\);[^}]*gap: var\(--product-segmented-control-gap\);[^}]*border: var\(--product-surface-border\);[^}]*border-radius: var\(--product-segmented-control-radius\);[^}]*padding: 0;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-indicator\s*\{[^}]*position: absolute;[^}]*z-index: 0;[^}]*top: 0;[^}]*left: 0;[^}]*height: var\(--product-segmented-control-option-size\);[^}]*border: 0;[^}]*border-radius: var\(--product-segmented-control-option-radius\);[^}]*background-color: var\(--product-surface-background\);[^}]*background-image: none;[^}]*background-clip: padding-box;[^}]*box-shadow: var\(--product-raised-control-shadow\);[^}]*opacity: 0;[^}]*pointer-events: none;[^}]*backdrop-filter: none;[^}]*will-change: width, transform;[^}]*transition: none;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-indicator\[data-ready="true"\]\s*\{[^}]*opacity: 1;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-option\s*\{[^}]*z-index: 1;[^}]*height: var\(--product-segmented-control-option-size\);[^}]*min-width: var\(--product-segmented-control-option-size\);[^}]*border-radius: var\(--product-segmented-control-option-radius\);[^}]*background: transparent;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-option-selected\s*\{[^}]*background: var\(--product-surface-background\);[^}]*box-shadow: var\(--product-raised-control-shadow\);/,
    "The selected button must remain a painted fallback until measurement is ready",
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-indicator-ready="true"\]\s*\.product-segmented-control-option-selected:not\(:disabled\)\s*\{[^}]*background: transparent;[^}]*box-shadow: none;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control\[data-indicator-ready="true"\]:has\(\s*\.product-segmented-control-option-selected:not\(:disabled\):active\s*\)\s*\.product-segmented-control-indicator\s*\{[^}]*box-shadow: var\(--product-raised-control-shadow-pressed\);/,
  );
  assert.doesNotMatch(
    styles,
    /\.product-segmented-control(?:::before|[^\s,{]*::before)/,
  );
});

test("segmented and workspace indicators share motion and accessibility fallbacks", () => {
  assert.match(
    styles,
    /:root\s*\{[^}]*--product-selection-motion-duration: 360ms;[^}]*--product-selection-motion-easing: cubic-bezier\(0\.22, 1, 0\.36, 1\);[^}]*--product-selection-motion-fade-duration: 120ms;/,
  );
  assert.match(
    styles,
    /\.product-segmented-control-indicator\[data-motion-ready="true"\]\s*\{[^}]*width var\(--product-selection-motion-duration\)\s*var\(--product-selection-motion-easing\),[^}]*transform var\(--product-selection-motion-duration\)\s*var\(--product-selection-motion-easing\),[^}]*opacity var\(--product-selection-motion-fade-duration\) ease;/,
  );
  assert.match(
    motionStyles,
    /\.workspace-tabs-indicator\[data-motion-ready="true"\]\s*\{[^}]*width var\(--product-selection-motion-duration\)\s*var\(--product-selection-motion-easing\),[^}]*transform var\(--product-selection-motion-duration\)\s*var\(--product-selection-motion-easing\),[^}]*opacity var\(--product-selection-motion-fade-duration\) ease;/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.product-segmented-control-indicator,\s*\.product-segmented-control-indicator\[data-motion-ready="true"\]\s*\{[^}]*transition: none;/,
  );
  assert.match(
    styles,
    /@media \(forced-colors: active\)[\s\S]*?\.product-segmented-control-indicator\s*\{[^}]*display: none !important;[^}]*\}[\s\S]*?\.product-segmented-control-option-selected\s*\{[^}]*border: 1px solid Highlight !important;[^}]*background: Highlight !important;[^}]*color: HighlightText !important;[^}]*box-shadow: none !important;/,
  );
});
