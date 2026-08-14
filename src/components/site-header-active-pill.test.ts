import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("Account TopNav alone enables one measured desktop active pill", () => {
  const header = source("src/components/site-header.tsx");
  const topNav = source("src/components/top-nav.tsx");
  const landing = source("src/components/landing-page.tsx");

  assert.match(header, /movingActivePill\?: boolean/);
  assert.match(header, /movingActivePill = false/);
  assert.match(topNav, /movingActivePill=\{primaryNavId === "account"\}/);
  assert.doesNotMatch(landing, /movingActivePill/);

  assert.match(header, /const navTrackRef = useRef<HTMLElement>\(null\)/);
  assert.match(
    header,
    /const navItemRefs = useRef\(new Map<string, HTMLLIElement>\(\)\)/,
  );
  assert.match(header, /const activeNavItemId = navItems\.find/);
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

test("active pill preserves SSR fallback and shares WorkspaceTabs motion", () => {
  const styles = source("src/app/styles/navigation.css");

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
    /\.site-header-nav-active-pill\[data-motion-ready="true"\]\s*\{[^}]*width 360ms cubic-bezier\(0\.22, 1, 0\.36, 1\),[^}]*transform 360ms cubic-bezier\(0\.22, 1, 0\.36, 1\),[^}]*opacity 120ms ease;/,
  );
  assert.match(
    styles,
    /\.site-header-nav-active-pill\[data-ready="true"\]\s*\{[^}]*view-transition-name: app-primary-nav-active-pill;[^}]*opacity: 1;/,
  );
  assert.match(
    styles,
    /\.site-header-nav-track\[data-active-pill-ready="true"\][\s\S]*?\.nav-pill-active[\s\S]*?background: transparent;/,
  );
  assert.match(
    styles,
    /:root\[data-page-transition-direction\]:not\([\s\S]*?data-page-transition-fallback="true"[\s\S]*?\.site-header-nav-active-pill\s*\{\s*transition: none;/,
  );
  assert.match(
    styles,
    /::view-transition-group\(app-primary-nav-active-pill\)\s*\{[^}]*animation-duration: 360ms;[^}]*animation-timing-function: cubic-bezier\(0\.22, 1, 0\.36, 1\);/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.site-header-nav-active-pill\[data-motion-ready="true"\][\s\S]*?transition: none;[\s\S]*?::view-transition-group\(app-primary-nav-active-pill\)[\s\S]*?animation: none;/,
  );
});
