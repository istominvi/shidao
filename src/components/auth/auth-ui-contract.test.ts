import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const layout = source("src/app/(auth)/layout.tsx");
const authPage = source("src/components/auth/auth-page.tsx");
const authCss = source("src/app/styles/auth.css");
const loginPage = source("src/app/(auth)/(entry)/login/page.tsx");
const loginForm = source("src/components/auth/login-form.tsx");
const joinPage = source("src/app/(auth)/(entry)/join/page.tsx");
const forgotPasswordPage = source("src/app/(auth)/forgot-password/page.tsx");
const resetPasswordPage = source("src/app/(auth)/reset-password/page.tsx");
const checkEmailPage = source("src/app/(auth)/join/check-email/page.tsx");
const confirmRoute = source("src/app/(auth)/auth/confirm/route.ts");

const authRoutes = [
  ["login", loginPage],
  ["join", joinPage],
  ["forgot password", forgotPasswordPage],
  ["reset password", resetPasswordPage],
  ["check email", checkEmailPage],
] as const;

test("the Auth route owns one product shell and its route-scoped stylesheet", () => {
  assert.match(layout, /import "\.\.\/styles\/auth\.css";/);
  assert.match(layout, /<TopNav layout="app" \/>/);
  assert.doesNotMatch(layout, /ProductShell|PageHero|landing-noise/);

  const nav = layout.indexOf('<TopNav layout="app" />');
  const children = layout.indexOf("{children}");
  assert.ok(
    nav >= 0 && children > nav,
    "navigation must precede route content",
  );
  assert.match(authPage, /<main className="app-page-shell auth-page-shell">/);
  assert.ok(
    authPage.indexOf("<main") < authPage.indexOf("{children}"),
    "AuthPage must own the semantic main around page content",
  );
});

test("all five Auth screens share one semantic AuthPage contract", () => {
  for (const [name, page] of authRoutes) {
    assert.match(
      page,
      /import \{[^}]*AuthPage[^}]*\} from "@\/components\/auth\/auth-page"/,
      `${name} must import AuthPage`,
    );
    assert.equal(
      (page.match(/<AuthPage\b/g) ?? []).length,
      1,
      `${name} must render exactly one AuthPage`,
    );
    assert.doesNotMatch(page, /<(?:main|h1)\b/);
  }

  assert.equal((authPage.match(/<h1\b/g) ?? []).length, 1);
  assert.match(authPage, /<section[\s\S]*?aria-labelledby="auth-page-title"/);
  assert.match(authPage, /<h1 id="auth-page-title"/);
  assert.doesNotMatch(authPage, /ProductShell|PageHero|StatusMessage/);
});

test("Auth feedback uses the shared accessible Alert primitive", () => {
  for (const [name, page] of [
    ["login", loginForm],
    ["join", joinPage],
    ["forgot password", forgotPasswordPage],
    ["reset password", resetPasswordPage],
    ["check email", checkEmailPage],
  ] as const) {
    assert.match(
      page,
      /import \{ Alert \} from "@\/components\/ui\/alert"/,
      `${name} must use the shared Alert`,
    );
    assert.match(page, /<Alert\b/);
    assert.doesNotMatch(page, /StatusMessage|auth-status|status-message/);
  }
});

test("Auth styling is flat, token-driven, responsive, and accessible", () => {
  assert.match(
    authCss,
    /\.auth-product-chrome\s*\{[\s\S]*?background: var\(--product-app-background\);/,
  );
  assert.match(
    authCss,
    /\.auth-card\s*\{[\s\S]*?border: var\(--product-surface-border\);[\s\S]*?border-radius: var\(--product-card-radius\);[\s\S]*?background: var\(--product-surface-background\);[\s\S]*?box-shadow: var\(--product-raised-surface-shadow\);/,
  );
  assert.match(
    authCss,
    /--auth-page-inline-start: max\(1rem, env\(safe-area-inset-left, 0px\)\);/,
  );
  assert.match(
    authCss,
    /--auth-page-inline-end: max\(1rem, env\(safe-area-inset-right, 0px\)\);/,
  );
  assert.match(
    authCss,
    /max-width: calc\([\s\S]*?30rem \+ var\(--auth-page-inline-start\) \+ var\(--auth-page-inline-end\)[\s\S]*?\);/,
  );
  assert.match(
    authCss,
    /padding-inline: var\(--auth-page-inline-start\) var\(--auth-page-inline-end\);/,
  );
  assert.match(
    authCss,
    /@media \(max-width: 767px\)[\s\S]*?\.auth-card\s*\{[\s\S]*?border-radius: 1rem;[\s\S]*?padding: 1\.25rem;/,
  );
  assert.match(
    authCss,
    /@media \(forced-colors: active\)[\s\S]*?\.auth-card\s*\{[\s\S]*?border-color: CanvasText;[\s\S]*?box-shadow: none;/,
  );
  assert.match(
    authCss,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration: 0\.01ms !important;[\s\S]*?transition-duration: 0\.01ms !important;/,
  );
  assert.doesNotMatch(
    authCss,
    /(?:linear|radial|conic)-gradient\s*\(|backdrop-filter\s*:|filter\s*:\s*blur\s*\(/i,
    "Auth must not regain the retired glass, gradient, or blur treatment",
  );
});

test("Auth loading never hides the whole screen behind a null Suspense fallback", () => {
  const surface = [
    layout,
    authPage,
    loginForm,
    ...authRoutes.map(([, page]) => page),
  ].join("\n");
  assert.doesNotMatch(surface, /fallback\s*=\s*\{\s*null\s*\}/);
});

test("the fragment relay keeps its self-contained UI paired with a restrictive CSP", () => {
  assert.match(confirmRoute, /function fragmentRelayResponse\(\)/);
  assert.match(confirmRoute, /<style>[\s\S]*?<\/style>/);
  assert.match(confirmRoute, /background: #f5f1e8/);
  assert.match(confirmRoute, /background: #fff/);
  assert.match(confirmRoute, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(confirmRoute, /@media \(forced-colors: active\)/);
  assert.match(confirmRoute, /<h1>Подтверждаем вход<\/h1>/);
  assert.doesNotMatch(confirmRoute, /<(?:script|link)[^>]+(?:src|href)=/i);

  assert.match(confirmRoute, /"Content-Security-Policy":/);
  for (const directive of [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "connect-src 'self'",
    "style-src 'unsafe-inline'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ]) {
    assert.ok(
      confirmRoute.includes(directive),
      `fragment relay CSP is missing ${directive}`,
    );
  }
  assert.match(confirmRoute, /"X-Content-Type-Options": "nosniff"/);
  assert.match(confirmRoute, /"X-Frame-Options": "DENY"/);
});
