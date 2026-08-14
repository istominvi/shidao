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
  assert.match(header, /const PRIMARY_NAV_HANDOFF_MS = 180/);
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
  assert.match(
    header,
    /event\.preventDefault\(\);\s*updateActivePillForItem\(item\.id\)/,
  );
  assert.match(
    header,
    /pageTransition\.navigate\(item\.href, \{ scroll: item\.scroll \}\)/,
  );
  assert.match(
    header,
    /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/,
  );
  assert.match(header, /window\.setTimeout\([\s\S]*?PRIMARY_NAV_HANDOFF_MS\)/);
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

test("active pill preserves SSR fallback and uses one fast local motion layer", () => {
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
    /\.site-header-nav-active-pill\[data-motion-ready="true"\]\s*\{[^}]*width 180ms cubic-bezier\(0\.22, 1, 0\.36, 1\),[^}]*transform 180ms cubic-bezier\(0\.22, 1, 0\.36, 1\);/,
  );
  assert.match(
    styles,
    /\.site-header-nav-active-pill\[data-ready="true"\]\s*\{\s*opacity: 1;/,
  );
  assert.doesNotMatch(styles, /app-primary-nav-active-pill/);
  assert.match(
    styles,
    /\.site-header-nav-track\[data-active-pill-ready="true"\][\s\S]*?\.site-header-nav-pill[\s\S]*?background: transparent;/,
  );
  assert.match(
    styles,
    /\.site-header-nav-track\[data-active-pill-ready="true"\] \.nav-pill-content\s*\{[^}]*color: #fff;[^}]*mix-blend-mode: difference;/,
  );
  assert.match(styles, /--header-pill-text: #000;/);
  assert.match(
    styles,
    /\.site-header-nav-track\s*\{[^}]*--header-pill-active-bg: #000;/,
  );
  assert.doesNotMatch(
    styles,
    /\.site-header-nav-track\s*\{[^}]*isolation:\s*isolate/,
  );
  assert.match(
    styles,
    /\.site-header-nav-pill,[\s\S]*?\.site-header-nav-pill:hover,[\s\S]*?\.site-header-nav-pill:focus-visible\s*\{\s*color: #000;/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.site-header-nav-active-pill\[data-motion-ready="true"\][\s\S]*?transition: none;/,
  );
});
