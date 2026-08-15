import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productSelectSource = readFileSync(
  "src/components/ui/product-select.tsx",
  "utf8",
);
const storeWorkspaceSource = readFileSync(
  "src/components/store/store-workspace.tsx",
  "utf8",
);
const globalStyles = readFileSync("src/app/globals.css", "utf8");

test("ProductSelect exposes one accessible custom listbox contract", () => {
  assert.match(productSelectSource, /role="combobox"/);
  assert.match(productSelectSource, /aria-haspopup="listbox"/);
  assert.match(productSelectSource, /aria-expanded=\{open\}/);
  assert.match(productSelectSource, /aria-controls=\{panelId\}/);
  assert.match(productSelectSource, /aria-activedescendant=/);
  assert.match(productSelectSource, /role="listbox"/);
  assert.match(productSelectSource, /aria-label=\{label\}/);
  assert.match(productSelectSource, /role="option"/);
  assert.match(productSelectSource, /aria-selected=\{selected\}/);
  assert.match(productSelectSource, /tabIndex=\{-1\}/);
  assert.match(productSelectSource, /disabled=\{option\.disabled\}/);
  assert.doesNotMatch(productSelectSource, /<select\b|<option\b/);
});

test("ProductSelect supports keyboard, typeahead, outside close, and focus restoration", () => {
  for (const key of [
    "Escape",
    "ArrowDown",
    "ArrowUp",
    "Home",
    "End",
    "Enter",
    "Tab",
  ]) {
    assert.match(productSelectSource, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(productSelectSource, /event\.key === " "/);
  assert.match(productSelectSource, /handleTypeahead\(event\.key\)/);
  assert.match(productSelectSource, /toLocaleLowerCase\("ru-RU"\)/);
  assert.match(
    productSelectSource,
    /document\.addEventListener\("pointerdown", handlePointerDown\)/,
  );
  assert.match(
    productSelectSource,
    /rootRef\.current\?\.contains\(event\.target as Node\)/,
  );
  assert.match(
    productSelectSource,
    /window\.requestAnimationFrame\(\(\) => triggerRef\.current\?\.focus\(\)\)/,
  );
  assert.match(
    productSelectSource,
    /if \(!event\.currentTarget\.contains\(event\.relatedTarget\)\) closeList\(\)/,
  );
});

test("ProductSelect uses the canonical button and dropdown visual tokens", () => {
  assert.match(
    productSelectSource,
    /className=\{productButtonClassName\(\s*"secondary",\s*"product-select-trigger",?\s*\)\}/,
  );
  assert.match(
    productSelectSource,
    /className="product-dropdown-surface product-select-panel"/,
  );
  assert.match(
    globalStyles,
    /\.product-select-trigger:focus-visible\s*\{[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: -2px;/,
  );
  assert.match(
    globalStyles,
    /\.product-select-panel\s*\{[^}]*position: absolute;[^}]*top: calc\(100% \+ 0\.5rem\);[^}]*min-width: 100%;/,
  );
  assert.match(
    globalStyles,
    /\.product-select-option\s*\{[^}]*min-height: var\(--product-row-height, 2\.5rem\);[^}]*border: 0;[^}]*border-radius: var\(--product-inner-control-radius, 0\.5rem\);[^}]*font-size: var\(--course-demo-control-font-size, 0\.88rem\);[^}]*font-weight: var\(--course-demo-control-font-weight, 400\);/,
  );
  assert.match(
    globalStyles,
    /\.product-select-option\[aria-selected="true"\] \.product-select-option-check\s*\{[^}]*opacity: 1;/,
  );
  assert.match(
    globalStyles,
    /@media \(forced-colors: active\)[\s\S]*?\.product-select-trigger:focus-visible,[\s\S]*?\.product-select-option\.is-active\s*\{[^}]*outline: 2px solid Highlight;[^}]*outline-offset: -2px;/,
  );
});

test("Store sorting consumes ProductSelect without restoring native or filter menus", () => {
  assert.match(
    storeWorkspaceSource,
    /import \{ ProductSelect \} from "@\/components\/ui\/product-select";/,
  );
  assert.match(
    storeWorkspaceSource,
    /<ProductSelect[\s\S]*?label="Сортировка товаров"[\s\S]*?value=\{filters\.sort\}[\s\S]*?options=\{STORE_SORT_OPTIONS\}[\s\S]*?onChange=\{\(sort\) => updateFilter\("sort", sort\)\}/,
  );
  assert.doesNotMatch(
    storeWorkspaceSource,
    /StoreFilterMenu|store-filter-menu|<Select\b|<select\b/,
  );
});
