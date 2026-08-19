import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const checkboxSource = source("src/components/ui/checkbox.tsx");
const editorSource = source(
  "src/components/course-builder/component-payload-editor.tsx",
);
const globalStyles = source("src/app/globals.css");

test("checkbox preserves native input semantics behind one product primitive", () => {
  assert.match(
    checkboxSource,
    /Omit<\s*InputHTMLAttributes<HTMLInputElement>,\s*"type"\s*>/,
  );
  assert.match(checkboxSource, /forwardRef<HTMLInputElement, CheckboxProps>/);
  assert.match(checkboxSource, /ref=\{ref\}/);
  assert.match(checkboxSource, /type="checkbox"/);
  assert.match(
    checkboxSource,
    /className=\{classNames\("product-checkbox", className\)\}/,
  );
  assert.match(checkboxSource, /\{\.\.\.props\}/);
});

test("course component options use the shared product checkbox contract", () => {
  assert.match(
    editorSource,
    /import \{ Checkbox \} from "@\/components\/ui\/checkbox"/,
  );
  assert.equal((editorSource.match(/<Checkbox\b/g) ?? []).length, 12);
  assert.doesNotMatch(editorSource, /auth-checkbox|type="checkbox"/);
  assert.doesNotMatch(globalStyles, /\.auth-checkbox\b/);
});

test("product checkbox covers interaction, motion and forced-color states", () => {
  assert.match(
    globalStyles,
    /\.product-checkbox\s*\{[^}]*appearance: none;[^}]*width: 20px;[^}]*height: 20px;[^}]*cursor: pointer;/,
  );
  assert.match(
    globalStyles,
    /\.product-checkbox:hover:not\(:disabled\)\s*\{[^}]*border-color:/,
  );
  assert.match(
    globalStyles,
    /\.product-checkbox:checked\s*\{[^}]*background: #141414;[^}]*border-color: #141414;/,
  );
  assert.match(
    globalStyles,
    /\.product-checkbox:focus-visible\s*\{[^}]*box-shadow: 0 0 0 3px rgba\(20, 20, 20, 0\.08\);/,
  );
  assert.match(
    globalStyles,
    /\.product-checkbox:disabled\s*\{[^}]*cursor: not-allowed;[^}]*opacity: 0\.56;/,
  );
  assert.match(
    globalStyles,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.product-checkbox::before\s*\{[^}]*transition: none;/,
  );
  assert.match(
    globalStyles,
    /@media \(forced-colors: active\)\s*\{[\s\S]*?\.product-checkbox\s*\{[^}]*appearance: auto;[^}]*border: 1px solid ButtonText;[^}]*forced-color-adjust: auto;[^}]*\}[\s\S]*?\.product-checkbox:focus-visible\s*\{[^}]*outline: 2px solid Highlight;[^}]*box-shadow: none;/,
  );
});
