import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

const buttonSource = source("src/components/ui/button.tsx");
const globalStyles = source("src/app/globals.css");

test("button exposes the inverse variant through the canonical class builder", () => {
  assert.match(
    buttonSource,
    /type ProductButtonVariant =\s*"primary" \| "secondary" \| "ghost" \| "inverse";/,
  );
  assert.match(
    buttonSource,
    /return classNames\("product-btn", `product-btn-\$\{variant\}`, className\);/,
  );
  assert.match(buttonSource, /variant = "primary"/);
});

test("inverse buttons keep one legible state contract in every product shell", () => {
  assert.match(
    globalStyles,
    /\.product-btn\.product-btn-inverse\s*\{[^}]*border-color: #171717;[^}]*background-color: #171717;[^}]*color: #fff;/,
  );
  assert.match(
    globalStyles,
    /\.app-page-shell \.product-btn\.product-btn-inverse\s*\{[^}]*border-color: var\(--product-control-foreground\);[^}]*background-color: var\(--product-control-foreground\);[^}]*color: #fff;/,
  );
  assert.match(
    globalStyles,
    /\.product-btn\.product-btn-inverse:hover:not\(:disabled\):not\(\s*\[aria-disabled="true"\]\s*\)\s*\{[^}]*border-color: #262626;[^}]*background-color: #262626;[^}]*color: #fff;/,
  );
  assert.match(
    globalStyles,
    /\.product-btn\.product-btn-inverse:active:not\(:disabled\):not\(\s*\[aria-disabled="true"\]\s*\)\s*\{[^}]*border-color: #0a0a0a;[^}]*background-color: #0a0a0a;[^}]*color: #fff;/,
  );
});

test("inverse buttons inherit the canonical focus, motion and forced-color safeguards", () => {
  assert.match(
    globalStyles,
    /\.product-btn:focus-visible\s*\{[^}]*outline: 2px solid var\(--product-control-focus-halo\);[^}]*outline-offset: 2px;/,
  );
  assert.match(
    globalStyles,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.product-btn\.product-btn,[\s\S]*?transition: none;[^}]*transform: none;/,
  );
  assert.match(
    globalStyles,
    /@media \(forced-colors: active\)\s*\{[\s\S]*?\.product-btn\.product-btn,[\s\S]*?\.product-btn\.product-btn:focus-visible:not\(:disabled\)\s*\{[^}]*border: 1px solid ButtonText;[^}]*background: ButtonFace;[^}]*color: ButtonText;[^}]*box-shadow: none;[^}]*forced-color-adjust: auto;[^}]*transform: none;/,
  );
});
