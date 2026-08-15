import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  pageTransitionPathname,
  resolvePageTransitionDirection,
} from "./page-transition";

test("page transition direction follows primary navigation order", () => {
  assert.equal(
    resolvePageTransitionDirection("/schedule", "/students"),
    "forward",
  );
  assert.equal(
    resolvePageTransitionDirection("/students", "/schedule"),
    "back",
  );
  assert.equal(
    resolvePageTransitionDirection("/students", "/store"),
    "forward",
  );
  assert.equal(resolvePageTransitionDirection("/store", "/courses"), "back");
  assert.equal(
    resolvePageTransitionDirection("/observing", "/courses"),
    "forward",
    "The observing compatibility route belongs to the Students section",
  );
  assert.equal(
    resolvePageTransitionDirection("/courses", "/observing"),
    "back",
  );
});

test("page transition direction follows drill depth inside a section", () => {
  assert.equal(
    resolvePageTransitionDirection("/courses", "/courses/new"),
    "forward",
  );
  assert.equal(
    resolvePageTransitionDirection(
      "/courses",
      "/courses/catalog/publication-id?audience=educators",
    ),
    "forward",
  );
  assert.equal(
    resolvePageTransitionDirection("/courses/course-id", "/courses"),
    "back",
  );
});

test("page transition paths ignore query/hash state and normalize trailing slashes", () => {
  assert.equal(
    pageTransitionPathname("/courses/?tab=catalog#results"),
    "/courses",
  );
  assert.equal(
    pageTransitionPathname("https://v2.shidao.ru/students/?tab=groups"),
    "/students",
  );
});

test("app layout keeps a persistent, reduced-motion-aware transition boundary", () => {
  const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
  const provider = readFileSync(
    "src/components/navigation/page-transition-provider.tsx",
    "utf8",
  );
  const link = readFileSync(
    "src/components/navigation/page-transition-link.tsx",
    "utf8",
  );

  assert.match(layout, /<PageTransitionProvider>/);
  assert.match(provider, /document as ViewTransitionDocument/);
  assert.match(provider, /startViewTransition/);
  assert.match(provider, /flushSync\(update\)/);
  assert.match(provider, /prefers-reduced-motion: reduce/);
  assert.match(provider, /TRANSITION_TIMEOUT_MS = 1_600/);
  assert.match(provider, /transitionTokenRef/);
  assert.match(provider, /pendingFallbackRouteRef/);
  assert.match(provider, /pendingNavigationIntentRef/);
  assert.match(provider, /isNavigationPending/);
  assert.match(provider, /activeTransitionRef\.current !== transition/);
  assert.match(provider, /READY_PAGE_HEADER_SELECTOR/);
  assert.match(provider, /READY_PAGE_HEADER_SELECTOR = "\.app-page-header"/);
  assert.match(provider, /new MutationObserver/);
  assert.doesNotMatch(
    provider,
    /attributeFilter: \["data-page-header-pending"\]/,
  );
  assert.match(
    provider,
    /startViewTransition\(\(\) => \{\s*if \(transitionTokenRef\.current !== token\) return;/,
  );
  assert.doesNotMatch(provider, /startViewTransition\(async/);
  assert.match(
    provider,
    /pendingNavigationIntentRef\.current = navigationIntent/,
  );
  assert.match(provider, /dataset\.pageTransitionFallback === "exit"/);
  assert.match(provider, /dataset\.pageTransitionDirection === direction/);
  assert.match(provider, /setTransitionState\(direction, "exit"\)/);
  assert.match(
    provider,
    /setTransitionState\(pendingFallback\.direction, "enter"\)/,
  );
  assert.match(
    provider,
    /cancelOngoingTransition\(\{ clearNavigationIntent: false \}\)/,
  );
  assert.match(link, /onNavigate=/);
  assert.match(link, /consumerPreventedNavigation/);
});
