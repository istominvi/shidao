import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("Account TopNav alone enables one measured desktop active pill", () => {
  const header = source("src/components/site-header.tsx");
  const topNav = source("src/components/top-nav.tsx");
  const appLayout = source("src/app/(app)/layout.tsx");
  const landing = source("src/components/landing-page.tsx");

  assert.match(header, /movingActivePill\?: boolean/);
  assert.match(header, /movingActivePill = false/);
  assert.match(topNav, /movingActivePill=\{primaryNavId === "account"\}/);
  assert.doesNotMatch(landing, /movingActivePill/);
  assert.match(appLayout, /<div className="app-product-chrome">/);
  assert.match(appLayout, /<PersistentTopNav \/>[\s\S]*?\{children\}/);
  assert.match(
    topNav,
    /export function shouldRenderPersistentProductTopNav\(pathname: string\)/,
  );
  for (const routeName of [
    "schedule",
    "students",
    "courses",
    "store",
    "profile",
    "onboarding",
  ]) {
    assert.match(topNav, new RegExp(`pathname === ROUTES\\.${routeName}`));
  }
  assert.match(topNav, /export function PersistentTopNav\(\)/);
  assert.match(
    topNav,
    /if \(!shouldRenderPersistentProductTopNav\(pathname\)\)\s*\{\s*return null;/,
  );
  assert.doesNotMatch(appLayout, /<PersistentTopNav[^>]*\bkey=/);
  assert.match(
    topNav,
    /pathname\.startsWith\(`\$\{ROUTES\.courses\}\/`\)[\s\S]*?!pathname\.endsWith\("\/student-preview"\)/,
  );
  for (const pagePath of [
    "src/app/(app)/schedule/page.tsx",
    "src/app/(app)/students/page.tsx",
    "src/app/(app)/courses/page.tsx",
    "src/app/(app)/courses/new/page.tsx",
    "src/app/(app)/courses/[courseId]/page.tsx",
    "src/app/(app)/courses/catalog/[publicationId]/page.tsx",
    "src/app/(app)/store/page.tsx",
    "src/app/(app)/profile/page.tsx",
    "src/app/(app)/onboarding/page.tsx",
  ]) {
    assert.doesNotMatch(source(pagePath), /<TopNav|import \{ TopNav \}/);
  }

  assert.match(header, /const navTrackRef = useRef<HTMLElement>\(null\)/);
  assert.match(
    header,
    /const navItemRefs = useRef\(new Map<string, HTMLLIElement>\(\)\)/,
  );
  assert.match(header, /const activeNavItemId = navItems\.find/);
  assert.doesNotMatch(header, /PRIMARY_NAV_HANDOFF_MS/);
  assert.doesNotMatch(header, /navigationHandoffTimerRef/);
  assert.match(header, /navTrack\.getBoundingClientRect\(\)/);
  assert.match(header, /activeItem\.getBoundingClientRect\(\)/);
  assert.match(header, /left: activeItemRect\.left - navTrackRect\.left/);
  assert.match(header, /width: activeItemRect\.width/);
  assert.match(header, /new ResizeObserver\(updateActivePill\)/);
  assert.match(
    header,
    /window\.addEventListener\("resize", updateActivePill\)/,
  );
  assert.match(
    header,
    /window\.requestAnimationFrame\(\(\) =>\s*setActivePillMotionReady\(true\)/,
  );
  assert.match(header, /data-active-pill-ready=\{activePill\.ready/);
  assert.match(header, /className="site-header-nav-active-pill"/);
  assert.match(header, /aria-hidden="true"/);
  assert.match(header, /data-ready=\{activePill\.ready/);
  assert.match(header, /activePill\.ready && activePillMotionReady/);
  assert.match(header, /event\.preventDefault\(\)/);
  assert.match(
    header,
    /pageTransition\.navigate\(item\.href, \{\s*scroll: item\.scroll,/,
  );
  assert.match(header, /pageTransition\.isNavigationPending\(\)/);
  assert.match(header, /prefetch=\{movingActivePill \? true : undefined\}/);
  assert.match(
    source("src/components/navigation/primitives.tsx"),
    /prefetch\?: boolean \| null;[\s\S]*?prefetch=\{prefetch\}/,
  );
  assert.match(
    header,
    /updateActivePillForItem\(item\.id\);[\s\S]*?pageTransition\.navigate\(item\.href/,
  );
  assert.doesNotMatch(header, /window\.setTimeout/);
  assert.match(header, /width: `\$\{activePill\.width\}px`/);
  assert.match(
    header,
    /transform: `translate3d\(\$\{activePill\.left\}px, 0, 0\)`/,
  );
  assert.ok(
    header.indexOf('className="site-header-nav-active-pill"') <
      header.indexOf('<ul className="site-header-nav-list">'),
    "The decorative pill must be a nav-track sibling, not invalid list content",
  );
});

test("active pill preserves SSR fallback and shares the canonical selection motion", () => {
  const styles = source("src/app/styles/navigation.css");
  const globals = source("src/app/globals.css");
  const pageMotion = source("src/app/styles/page-motion.css");

  assert.match(
    globals,
    /--product-selection-motion-duration: 360ms;[\s\S]*?--product-selection-motion-easing: cubic-bezier\(0\.22, 1, 0\.36, 1\);[\s\S]*?--product-selection-motion-fade-duration: 120ms;/,
  );

  assert.match(
    styles,
    /\.nav-pill-active\s*\{[^}]*background: var\(--header-pill-active-bg\);[^}]*color: #fff;/,
  );
  assert.match(
    styles,
    /\.site-header-nav-active-pill\s*\{[^}]*position: absolute;[^}]*display: none;[^}]*background: var\(--header-pill-active-bg\);[^}]*opacity: 0;[^}]*pointer-events: none;[^}]*transition: none;/,
  );
  assert.match(
    styles,
    /@media \(min-width: 768px\)\s*\{\s*\.site-header-nav-active-pill\s*\{\s*display: block;/,
  );
  assert.match(
    styles,
    /\.site-header-nav-active-pill\[data-motion-ready="true"\]\s*\{[^}]*width var\(--product-selection-motion-duration\)[^}]*var\(--product-selection-motion-easing\),[^}]*transform var\(--product-selection-motion-duration\)[^}]*var\(--product-selection-motion-easing\),[^}]*opacity var\(--product-selection-motion-fade-duration\) ease;/,
  );
  assert.doesNotMatch(
    styles,
    /\.site-header-nav-active-pill\[data-motion-ready="true"\]\s*\{[^}]*\b180ms\b/,
  );
  assert.match(
    pageMotion,
    /\.workspace-tabs-indicator\[data-motion-ready="true"\]\s*\{[^}]*width var\(--product-selection-motion-duration\)[^}]*var\(--product-selection-motion-easing\),[^}]*transform var\(--product-selection-motion-duration\)[^}]*var\(--product-selection-motion-easing\),[^}]*opacity var\(--product-selection-motion-fade-duration\) ease;/,
  );
  assert.match(
    globals,
    /\.product-segmented-control-indicator\[data-motion-ready="true"\]\s*\{[^}]*width var\(--product-selection-motion-duration\)[^}]*var\(--product-selection-motion-easing\),[^}]*transform var\(--product-selection-motion-duration\)[^}]*var\(--product-selection-motion-easing\),[^}]*opacity var\(--product-selection-motion-fade-duration\) ease;/,
  );
  assert.match(
    styles,
    /\.site-header-nav-active-pill\[data-ready="true"\]\s*\{\s*opacity: 1;/,
  );
  assert.doesNotMatch(styles, /app-primary-nav-active-pill/);
  assert.match(styles, /--header-pill-hover-bg: rgba\(0, 0, 0, 0\.05\);/);
  assert.match(
    styles,
    /\.site-header-nav-track\[data-active-pill-ready="true"\] \.site-header-nav-pill\s*\{\s*background: transparent;/,
  );
  assert.match(
    styles,
    /\.site-header-nav-track\[data-active-pill-ready="true"\][\s\S]*?\.site-header-nav-pill:not\(\.nav-pill-active\):hover,[\s\S]*?\.site-header-nav-pill:not\(\.nav-pill-active\):focus-visible\s*\{\s*background: var\(--header-pill-hover-bg\);/,
  );
  assert.doesNotMatch(
    styles,
    /\.site-header-nav-pill\.nav-pill-active[^,{]*\{[^}]*background: var\(--header-pill-hover-bg\);/,
  );
  assert.match(
    styles,
    /\.site-header-nav-track\[data-active-pill-ready="true"\] \.nav-pill-content\s*\{[^}]*color: #fff;[^}]*mix-blend-mode: difference;/,
  );
  assert.match(styles, /--header-pill-text: #000;/);
  assert.match(
    styles,
    /\.site-header-nav-track\s*\{[^}]*--header-pill-active-bg: #000;[^}]*isolation: isolate;[^}]*background: #fff;/,
  );
  assert.doesNotMatch(styles, /\.site-header-nav-list\s*\{[^}]*z-index:/);
  assert.match(
    styles,
    /\.site-header-nav-pill,[\s\S]*?\.site-header-nav-pill:hover,[\s\S]*?\.site-header-nav-pill:focus-visible\s*\{\s*color: #000;/,
  );
  assert.match(styles, /\.site-header-nav-pill\s*\{\s*cursor: pointer;/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.site-header-nav-active-pill\[data-motion-ready="true"\][\s\S]*?transition: none;/,
  );
});
