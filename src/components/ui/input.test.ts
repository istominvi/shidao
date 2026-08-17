import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const inputSource = source("src/components/ui/input.tsx");
const globalStyles = source("src/app/globals.css");
const teachingStyles = source("src/app/styles/teaching-hub.css");
const rootLayoutSource = source("src/app/layout.tsx");
const appLayoutSource = source("src/app/(app)/layout.tsx");

test("single-line product inputs use one static raised typography contract", () => {
  assert.match(
    inputSource,
    /return classNames\("product-control", `product-control-\$\{kind\}`, className\)/,
  );
  assert.match(
    inputSource,
    /<input className=\{productControlClassName\("input", className\)\} \{\.\.\.props\} \/>/,
  );
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-control-height: 2\.5rem;[^}]*--product-control-radius: var\(--product-element-radius\);[^}]*--product-control-icon-size: 1rem;[^}]*--product-control-icon-stroke-width: 2px;[^}]*--product-surface-background: #fff;[^}]*--product-surface-border-width: 1px;[^}]*--product-surface-border-color: oklch\(0 0 0 \/ 0\.1\);[^}]*--product-surface-border: var\(--product-surface-border-width\) solid\s+var\(--product-surface-border-color\);[^}]*--product-raised-surface-shadow: var\(--product-raised-control-shadow\);[^}]*--product-entry-control-shadow: var\(--product-raised-surface-shadow\);[^}]*--product-control-focus-halo: rgba\(20, 20, 20, 0\.58\);[^}]*--product-entry-control-foreground: #171717;[^}]*--product-entry-control-font-size: 0\.9rem;[^}]*--product-entry-control-font-weight: 600;[^}]*--product-entry-control-line-height: 1;/,
  );
  assert.match(
    globalStyles,
    /\.course-demo-shell\s*\{[^}]*--product-entry-control-foreground: var\(--course-demo-control-foreground\);[^}]*--product-entry-control-font-size: var\(--course-demo-control-font-size\);[^}]*--product-entry-control-font-weight: var\(--course-demo-control-font-weight\);[^}]*--product-entry-control-line-height: var\(--course-demo-control-line-height\);/,
  );
  assert.match(
    globalStyles,
    /\.product-control\s*\{[^}]*height: var\(--product-control-height\);[^}]*border: var\(--product-surface-border\);[^}]*background: var\(--product-surface-background\);[^}]*background-clip: padding-box;[^}]*color: var\(--product-entry-control-foreground\);[^}]*font-family: inherit;[^}]*font-size: var\(--product-entry-control-font-size\);[^}]*font-weight: var\(--product-entry-control-font-weight\);[^}]*line-height: var\(--product-entry-control-line-height\);/,
  );
  assert.match(
    globalStyles,
    /\.field-input\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background: var\(--product-surface-background\);[^}]*background-clip: padding-box;/,
  );
  assert.match(
    globalStyles,
    /:is\(input, select\)\.field-input\s*\{[^}]*height: var\(--product-control-height\);[^}]*border: var\(--product-surface-border\);[^}]*background: var\(--product-surface-background\);[^}]*background-clip: padding-box;[^}]*padding-block: 0;[^}]*color: var\(--product-entry-control-foreground\);[^}]*font-family: inherit;[^}]*font-size: var\(--product-entry-control-font-size\);[^}]*font-weight: var\(--product-entry-control-font-weight\);[^}]*line-height: var\(--product-entry-control-line-height\);[^}]*box-shadow: var\(--product-entry-control-shadow\);/,
  );
  assert.match(
    globalStyles,
    /input\.product-control-input,\s*input\.product-control-search\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background: var\(--product-surface-background\);[^}]*background-clip: padding-box;[^}]*box-shadow: var\(--product-entry-control-shadow\);/,
  );
  assert.doesNotMatch(
    /\.field-input\s*\{[^}]*\}/.exec(globalStyles)?.[0] ?? "",
    /product-entry-control-shadow/,
    "the multiline field-input base must not inherit the single-line shadow",
  );
});

test("search fields keep one foreground across copy and icons", () => {
  assert.match(
    globalStyles,
    /input\.field-input::placeholder\s*\{[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.match(
    globalStyles,
    /input\.product-control-input::placeholder,\s*input\.product-control-search::placeholder\s*\{[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.match(
    globalStyles,
    /\.product-search-wrap,\s*\.product-select-wrap\s*\{[^}]*color: var\(--product-entry-control-foreground\);/,
  );
  assert.match(
    globalStyles,
    /\.product-search-icon\s*\{[^}]*color: currentColor;[^}]*opacity: 1;[^}]*pointer-events: none;/,
  );
  assert.match(
    teachingStyles,
    /\.teaching-hub-search\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background: (?:var\(--product-surface-background\)|#fff);[^}]*background-clip: padding-box;[^}]*box-shadow: var\(--product-entry-control-shadow\);/,
  );
  assert.match(
    teachingStyles,
    /\.teaching-hub-search\s*\{[^}]*color: var\(--product-entry-control-foreground\);[^}]*\}[\s\S]*?\.teaching-hub-search input\s*\{[^}]*color: currentColor;[^}]*font-family: inherit;[^}]*font-size: var\(--product-entry-control-font-size\);[^}]*font-weight: var\(--product-entry-control-font-weight\);[^}]*line-height: var\(--product-entry-control-line-height\);/,
  );
  assert.match(
    teachingStyles,
    /\.teaching-hub-search input::placeholder\s*\{[^}]*color: currentColor;[^}]*opacity: 1;/,
  );
  assert.match(
    teachingStyles,
    /\.student-directory-picker-search input\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background: (?:var\(--product-surface-background\)|#fff);[^}]*background-clip: padding-box;[^}]*color: var\(--product-entry-control-foreground\);[^}]*font-family: inherit;[^}]*font-size: var\(--product-entry-control-font-size\);[^}]*font-weight: var\(--product-entry-control-font-weight\);[^}]*line-height: var\(--product-entry-control-line-height\);[^}]*box-shadow: var\(--product-entry-control-shadow\);/,
  );
});

test("input focus and forced colors preserve an accessible indicator", () => {
  const genericProductFocus =
    /\.product-control:focus-visible\s*\{[^}]*\}/.exec(globalStyles)?.[0] ?? "";
  const productInputFocus =
    /input\.product-control-input:focus,\s*input\.product-control-search:focus\s*\{[^}]*\}/.exec(
      globalStyles,
    )?.[0] ?? "";
  const genericFieldFocus =
    /\.field-input:focus\s*\{[^}]*\}/.exec(globalStyles)?.[0] ?? "";
  const fieldInputFocus =
    /input\.field-input:focus\s*\{[^}]*\}/.exec(globalStyles)?.[0] ?? "";
  const forcedColors =
    /@media \(forced-colors: active\)\s*\{[\s\S]*\}/.exec(globalStyles)?.[0] ??
    "";

  assert.match(
    genericProductFocus,
    /border: var\(--product-surface-border\);[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: 2px;/,
  );
  assert.match(
    productInputFocus,
    /border: var\(--product-surface-border\);[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: 0;[^}]*box-shadow: var\(--product-entry-control-shadow\);/,
  );
  assert.match(
    genericFieldFocus,
    /border: var\(--product-surface-border\);[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: 2px;/,
  );
  assert.match(
    fieldInputFocus,
    /border: var\(--product-surface-border\);[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: 0;[^}]*box-shadow: var\(--product-entry-control-shadow\);/,
  );
  assert.match(
    teachingStyles,
    /\.teaching-hub-search:focus-within\s*\{[^}]*border: var\(--product-surface-border\);[^}]*background-color: (?:var\(--product-surface-background\)|#fff);[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: 0;[^}]*box-shadow: var\(--product-entry-control-shadow\);/,
  );
  assert.equal(
    (teachingStyles.match(/\.teaching-hub-search:focus-within\s*\{/g) ?? [])
      .length,
    1,
    "the canonical search focus rule must not be shadowed later in the cascade",
  );
  assert.match(
    teachingStyles,
    /\.student-directory-picker-search input:focus\s*\{[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: 0;[^}]*box-shadow: var\(--product-entry-control-shadow\);/,
  );
  assert.match(
    forcedColors,
    /\.product-control,\s*input\.product-control-input,\s*input\.product-control-search,\s*\.field-input,\s*input\.field-input,\s*\.teaching-hub-search,\s*\.student-directory-picker-search input\s*\{[^}]*border: 1px solid FieldText;[^}]*background: Field;[^}]*color: FieldText;[^}]*box-shadow: none;/,
  );
  assert.match(
    forcedColors,
    /\.product-control:focus-visible,\s*input\.product-control-input:focus,\s*input\.product-control-search:focus,\s*\.field-input:focus,\s*input\.field-input:focus,\s*\.teaching-hub-search:focus-within,\s*\.student-directory-picker-search input:focus\s*\{[^}]*outline: 2px solid Highlight;[^}]*box-shadow: none;/,
  );
  assert.match(
    forcedColors,
    /\.product-control:focus-visible,\s*\.field-input:focus\s*\{[^}]*outline-offset: 2px;/,
  );
  assert.match(
    forcedColors,
    /input\.product-control-input:focus,\s*input\.product-control-search:focus,\s*input\.field-input:focus,\s*\.teaching-hub-search:focus-within,\s*\.student-directory-picker-search input:focus\s*\{[^}]*outline-offset: 0;/,
  );
});

test("narrow and coarse-touch editable controls prevent iOS focus zoom without disabling page zoom", () => {
  const touchMediaQuery =
    "@media (max-width: 767px), (hover: none) and (pointer: coarse)";
  const touchMediaStart = globalStyles.indexOf(touchMediaQuery);

  assert.ok(touchMediaStart >= 0);

  const narrowMediaStart = globalStyles.indexOf(
    "@media (max-width: 767px)",
    touchMediaStart + touchMediaQuery.length,
  );

  assert.ok(narrowMediaStart > touchMediaStart);

  const touchStyles = globalStyles.slice(touchMediaStart, narrowMediaStart);
  const editableRuleStart = touchStyles.indexOf(":where(");
  const editableRuleEnd = touchStyles.indexOf("\n  }", editableRuleStart);
  const editableRule = touchStyles.slice(
    editableRuleStart,
    editableRuleEnd + 4,
  );

  assert.ok(editableRuleStart >= 0);
  assert.match(editableRule, /input:not\(\[type="button"\]\)/);
  assert.match(editableRule, /select,/);
  assert.match(editableRule, /textarea/);
  assert.match(editableRule, /font-size: max\(1rem, 16px\) !important;/);
  for (const nonEditableType of [
    "checkbox",
    "radio",
    "range",
    "color",
    "file",
    "hidden",
  ]) {
    assert.match(editableRule, new RegExp(`\\[type="${nonEditableType}"\\]`));
  }

  assert.match(
    touchStyles,
    /\.course-demo-shell\s*\{[^}]*--product-control-icon-size: 1\.25rem;[^}]*--course-demo-control-font-size: 1rem;/,
  );
  assert.match(
    touchStyles,
    /\.course-demo-shell \.product-btn,\s*\.course-demo-shell \.product-control,\s*\.course-demo-shell :is\(input, select\)\.field-input,\s*\.course-demo-shell \.teaching-date-navigator,\s*\.course-demo-shell \.teaching-hub-search\s*\{[^}]*height: var\(--product-control-height\);[^}]*min-height: var\(--product-control-height\);[^}]*font-size: 1rem;/,
  );
  assert.match(
    touchStyles,
    /\.course-demo-shell \.product-control-search\s*\{[^}]*height: var\(--product-control-height\);[^}]*min-height: var\(--product-control-height\);[^}]*font-size: 1rem;/,
  );
  assert.doesNotMatch(
    touchStyles,
    /--(?:course-demo|product)-control-height:\s*(?:3rem|48px)/,
  );

  assert.match(appLayoutSource, /viewportFit: "cover"/);
  assert.doesNotMatch(
    `${rootLayoutSource}\n${appLayoutSource}`,
    /maximumScale|minimumScale|userScalable/,
  );
});
