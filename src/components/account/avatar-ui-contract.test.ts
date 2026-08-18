import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import Image from "next/image";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("preset images use the responsive Next image pipeline", () => {
  const markup = renderToStaticMarkup(
    createElement(Image, {
      src: "/avatars/presets/sd-avatar-v1-01.webp",
      alt: "",
      width: 96,
      height: 96,
      quality: 75,
    }),
  );

  assert.match(markup, /\/_next\/image\?url=%2Favatars%2Fpresets%2F/);
  assert.match(markup, /srcSet=/);
});

test("account settings keep avatar choices compact and require confirmation", () => {
  const settings = source("src/components/account/account-settings-panel.tsx");
  const form = source("src/components/account/avatar-settings-form.tsx");

  assert.match(settings, /title="Аватар"/);
  assert.match(settings, /<AvatarSettingsForm \/>/);
  assert.match(form, /Загрузить фото/);
  assert.match(form, /Выбрать аватар/);
  assert.match(form, /fileInputRef\.current\.click\(\)/);
  assert.match(form, /dialog === "preset"/);
  assert.match(form, /dialog === "custom"/);
  assert.match(
    form,
    /function openPresetDialog\(\)[\s\S]*setSelectedPreset\(currentPreset\)/,
  );
  assert.match(
    form,
    /const previewAvatar: AccountAvatarView = selectedPreset[\s\S]*: currentAvatar/,
  );
  assert.equal((form.match(/<DialogShell/g) ?? []).length, 2);
  assert.match(form, /ACCOUNT_AVATAR_PRESETS\.map/);
  assert.match(
    form,
    /<Image[\s\S]*?src=\{preset\.src\}[\s\S]*?quality=\{75\}[\s\S]*?sizes=/,
  );
  assert.match(form, /type="radio"/);
  assert.match(form, /checked=\{selected\}/);
  assert.match(form, /Профиль нельзя оставить без/);
  assert.match(form, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(form, /ACCOUNT_AVATAR_MAX_UPLOAD_BYTES/);
  assert.match(form, /event\.key !== "Escape"/);
  assert.ok((form.match(/Сохранить/g) ?? []).length >= 2);
  assert.ok((form.match(/Отмена/g) ?? []).length >= 2);
  assert.match(form, /formData\.set\("expectedRevision"/);
  assert.match(form, /presetKey: selectedPreset/);
  assert.equal(
    (form.match(/fetch\("\/api\/settings\/profile\/avatar"/g) ?? []).length,
    2,
  );
  assert.ok((form.match(/await refetchSession\(\)/g) ?? []).length >= 2);
});

test("protected mobile navigation shows the Account avatar; desktop avatar links to Profile", () => {
  const navigation = source("src/components/session-nav-actions.tsx");
  const navigationPrimitives = source(
    "src/components/navigation/primitives.tsx",
  );
  const avatarImage = source("src/components/account/avatar-image.tsx");
  const navigationCss = source("src/app/styles/navigation.css");
  const globalStyles = source("src/app/globals.css");
  const navPanelStyles =
    /\.nav-dropdown-panel\s*\{[^}]*\}/.exec(navigationCss)?.[0] ?? "";

  assert.match(
    navigation,
    /<AvatarImage[\s\S]*?avatar=\{state\.avatar\}[\s\S]*?size=\{40\}/,
  );
  assert.match(navigation, /variant = "top-nav"/);
  assert.match(navigation, /const isProtectedTopNav = variant === "top-nav"/);
  assert.match(
    navigation,
    /aria-label=\{open \? "Закрыть меню аккаунта" : "Открыть меню аккаунта"\}[\s\S]*?className="nav-user-trigger nav-account-menu-trigger inline-flex cursor-pointer items-center justify-center md:hidden"/,
  );
  assert.match(
    navigation,
    /<X[\s\S]*?className="nav-main-menu-icon nav-mobile-action-icon"[\s\S]*?\/>[\s\S]*?<Menu[\s\S]*?className="nav-main-menu-icon nav-mobile-action-icon"[\s\S]*?\/>/,
  );
  assert.match(
    navigation,
    /<NavigationDropdownPanel[\s\S]*?aria-label="Меню аккаунта"[\s\S]*?className="[^"]*nav-account-menu-mobile[^"]*md:hidden"/,
  );
  assert.match(
    navigation,
    /<PageTransitionLink\s+href=\{profileTabHref\("profile"\)\}[\s\S]*?aria-label="Открыть профиль"[\s\S]*?nav-profile-link[\s\S]*?isProtectedTopNav \? "hidden md:inline-flex" : "inline-flex"[\s\S]*?<AvatarImage/,
  );
  assert.doesNotMatch(
    navigation,
    /PROFILE_NAV_ITEMS|PROFILE_MENU_ICONS|handleSignOut|signOutViaServer|LogOut|portalMenu|createPortal/,
  );
  assert.match(
    navigation,
    /<div className="nav-dropdown-profile">[\s\S]*?<AvatarImage[\s\S]*?avatar=\{state\.avatar\}[\s\S]*?initials=\{state\.initials\}[\s\S]*?size=\{48\}[\s\S]*?className="nav-user-trigger-avatar nav-dropdown-profile-avatar"/,
  );
  assert.match(
    navigation,
    /<item\.icon[\s\S]*?className="nav-mobile-action-icon text-neutral-500"/,
  );
  assert.match(
    navigation,
    /<UserRound[\s\S]*?className="nav-mobile-action-icon text-neutral-500"/,
  );
  assert.doesNotMatch(navigation, /size=\{24\}/);
  assert.match(avatarImage, /rounded-xl/);
  assert.match(avatarImage, /style=\{\{ width: size, height: size \}\}/);
  assert.match(avatarImage, /width=\{size\}/);
  assert.match(avatarImage, /height=\{size\}/);
  assert.match(
    avatarImage,
    /loader=\{avatar\.kind === "custom" \? privateAvatarLoader : undefined\}/,
  );
  assert.match(
    avatarImage,
    /quality=\{avatar\.kind === "preset" \? 75 : undefined\}/,
  );
  assert.match(avatarImage, /width=\$\{deliveryWidth\}/);
  assert.match(avatarImage, /<span aria-hidden="true">\{initials\}<\/span>/);
  assert.match(avatarImage, /absolute inset-0 h-full w-full object-cover/);
  assert.match(avatarImage, /onLoad=\{\(\) => setLoadedSrc\(src\)\}/);
  assert.match(avatarImage, /onError=\{\(\) => setFailedSrc\(src\)\}/);
  assert.match(
    navigationCss,
    /--header-pill-height: 2\.5rem[\s\S]*?\.nav-user-trigger-avatar\s*\{[\s\S]*?border-radius: var\(--product-element-radius/,
  );
  const mobileTriggerStyles =
    /\.nav-account-menu-trigger\s*\{[^}]*\}/.exec(navigationCss)?.[0] ?? "";
  const mobileNavigationStart = navigationCss.indexOf(
    "@media (max-width: 767px)",
  );
  const baseNavigationStyles = navigationCss.slice(0, mobileNavigationStart);
  const mobileTriggerIconStyles =
    /\.site-header-shell-demo \.nav-mobile-action-icon\s*\{[^}]*\}/.exec(
      navigationCss,
    )?.[0] ?? "";
  const baseMenuItemStyles =
    /(?:^|\n)\.nav-dropdown-item\s*\{[^}]*\}/.exec(baseNavigationStyles)?.[0] ??
    "";
  const mobileMenuStyles =
    /\.nav-account-menu-mobile\s*\{[^}]*\}/.exec(navigationCss)?.[0] ?? "";
  const mobileMenuSurfaceStyles =
    /\.product-dropdown-surface\.nav-account-menu-mobile\s*\{[^}]*\}/.exec(
      navigationCss,
    )?.[0] ?? "";
  const mobileMenuItemStyles =
    /\.nav-account-menu-mobile\s+\.nav-dropdown-item\s*\{[^}]*\}/.exec(
      navigationCss,
    )?.[0] ?? "";
  const mobileProfileStyles =
    /\.nav-account-menu-mobile\s+\.nav-dropdown-profile\s*\{[^}]*\}/.exec(
      navigationCss,
    )?.[0] ?? "";
  const mobileProfileAvatarStyles =
    /\.nav-account-menu-mobile\s+\.nav-dropdown-profile-avatar\s*\{[^}]*\}/.exec(
      navigationCss,
    )?.[0] ?? "";
  const mobileProfileEmailStyles =
    /\.nav-account-menu-mobile\s+\.nav-dropdown-profile\s+p:last-child:not\(:first-child\)\s*\{[^}]*\}/.exec(
      navigationCss,
    )?.[0] ?? "";
  const mobileMenuItemFocusStyles =
    Array.from(
      navigationCss.matchAll(
        /\.nav-account-menu-mobile\s+\.nav-dropdown-item:focus-visible\s*\{[^}]*\}/g,
      ),
    )
      .map((match) => match[0])
      .find((rule) => /box-shadow: none;/.test(rule)) ?? "";
  const mobileBrandStyles =
    /@media \(max-width: 767px\)[\s\S]*?\.site-header-shell-demo\s+\.site-header-brand\s*\{[^}]*\}/.exec(
      navigationCss,
    )?.[0] ?? "";
  const demoHeaderStyles =
    /\.site-header-shell-demo\s*\{[^}]*\}/.exec(navigationCss)?.[0] ?? "";

  assert.match(mobileTriggerStyles, /width: (?:3rem|48px);/);
  assert.match(mobileTriggerStyles, /height: (?:3rem|48px);/);
  assert.match(mobileTriggerStyles, /min-height: (?:3rem|48px);/);
  assert.match(
    mobileTriggerStyles,
    /background: var\(--product-surface-background, #fff\);/,
  );
  assert.match(mobileTriggerStyles, /box-shadow: none;/);
  assert.match(
    mobileTriggerStyles,
    /-webkit-tap-highlight-color: transparent;/,
  );
  assert.match(
    mobileTriggerIconStyles,
    /width: var\(--course-demo-control-icon-size, 1rem\);/,
  );
  assert.match(
    mobileTriggerIconStyles,
    /height: var\(--course-demo-control-icon-size, 1rem\);/,
  );
  assert.match(
    mobileTriggerIconStyles,
    /flex: 0 0 var\(--course-demo-control-icon-size, 1rem\);/,
  );
  assert.doesNotMatch(
    `${navigationCss}\n${globalStyles}`,
    /--product-(?:touch-control-font-size|control-icon-stroke-width)|vector-effect:\s*non-scaling-stroke/,
  );
  assert.match(mobileBrandStyles, /font-size: (?:1\.625rem|26px);/);
  assert.match(demoHeaderStyles, /border-radius:/);
  assert.match(
    demoHeaderStyles,
    /background-color: var\(--product-surface-background, #fff\);/,
  );
  assert.match(demoHeaderStyles, /background-image: none;/);
  assert.match(demoHeaderStyles, /opacity: 1;/);
  assert.match(demoHeaderStyles, /backdrop-filter: none;/);
  assert.match(demoHeaderStyles, /-webkit-backdrop-filter: none;/);
  assert.match(
    mobileMenuSurfaceStyles,
    /background-color: var\(--product-surface-background, #fff\);/,
  );
  assert.match(mobileMenuSurfaceStyles, /background-image: none;/);
  assert.match(mobileMenuSurfaceStyles, /opacity: 1;/);
  assert.match(mobileMenuSurfaceStyles, /backdrop-filter: none;/);
  assert.match(mobileMenuSurfaceStyles, /-webkit-backdrop-filter: none;/);
  assert.match(
    mobileMenuStyles,
    /top: calc\(100% \+ (?:0\.75rem|12px)\);/,
    "The mobile menu must keep a 12px gap below the header",
  );
  assert.deepEqual(
    {
      left: /left: -0\.5rem;/.test(mobileMenuStyles),
      right: /right: -0\.5rem;/.test(mobileMenuStyles),
      safeViewportInset:
        /padding-inline: max\((?:0\.75rem|12px), env\(safe-area-inset-left, 0px\)\)[\s\S]*?max\((?:0\.75rem|12px), env\(safe-area-inset-right, 0px\)\)/.test(
          navigationCss,
        ),
    },
    { left: true, right: true, safeViewportInset: true },
    "The menu must cancel the 8px shell inset and retain the 12px safe viewport inset",
  );
  assert.match(mobileMenuItemStyles, /min-height: (?:4\.25rem|68px);/);
  assert.match(baseMenuItemStyles, /font-size: 0\.875rem;/);
  assert.match(baseMenuItemStyles, /font-weight: 600;/);
  assert.doesNotMatch(
    mobileMenuItemStyles,
    /font-size:|font-weight:|line-height:/,
  );
  assert.match(
    mobileMenuItemStyles,
    /-webkit-tap-highlight-color: transparent;/,
  );
  assert.match(mobileProfileStyles, /display: flex;/);
  assert.match(mobileProfileStyles, /border-bottom: 1px solid rgba\(/);
  assert.match(
    mobileProfileStyles,
    /background: var\(--product-surface-background, #fff\);/,
  );
  assert.match(mobileProfileStyles, /padding: (?:1rem|16px);/);
  assert.match(
    mobileProfileStyles,
    /margin: calc\(-1 \* var\(--product-dropdown-inset, 0\.375rem\)\)/,
  );
  assert.match(mobileProfileAvatarStyles, /width: (?:3rem|48px);/);
  assert.match(mobileProfileAvatarStyles, /height: (?:3rem|48px);/);
  assert.doesNotMatch(mobileProfileAvatarStyles, /font-size:/);
  assert.match(
    baseNavigationStyles,
    /\.nav-user-trigger-avatar\s*\{[^}]*font-size: 0\.72rem;/,
  );
  assert.match(
    navigation,
    /<p className="truncate text-sm font-semibold text-neutral-900">/,
  );
  assert.match(navigation, /<p className="truncate text-xs text-neutral-500">/);
  assert.doesNotMatch(
    navigationCss,
    /\.nav-account-menu-mobile\s+\.nav-dropdown-profile p:first-child\s*\{/,
  );
  assert.match(mobileProfileEmailStyles, /margin-top: 0\.25rem;/);
  assert.doesNotMatch(
    mobileProfileEmailStyles,
    /font-size:|font-weight:|line-height:/,
  );
  assert.match(mobileMenuItemFocusStyles, /box-shadow: none;/);
  assert.match(
    navigationPrimitives,
    /className=\{classNames\(\s*"product-dropdown-surface",\s*"nav-dropdown-panel"/,
  );
  assert.doesNotMatch(
    navPanelStyles,
    /border(?:-radius)?:|background:|padding:|box-shadow:|backdrop-filter:/,
  );
  assert.match(
    globalStyles,
    /:root\s*\{[^}]*--product-surface-background: #fff;[^}]*--product-surface-border-width: 1px;[^}]*--product-surface-border-color: oklch\(0 0 0 \/ 0\.1\);[^}]*--product-surface-border: var\(--product-surface-border-width\) solid\s+var\(--product-surface-border-color\);[^}]*--product-dropdown-background: var\(--product-surface-background\);[^}]*--product-dropdown-shadow: 0 24px 32px -24px rgba\(20, 20, 20, 0\.24\);[^}]*\}[\s\S]*?\.product-dropdown-surface\s*\{[^}]*border: 0;[^}]*--product-element-radius, 0\.75rem[^}]*background: var\(--product-dropdown-background, #fff\);[^}]*padding: var\(--product-dropdown-inset, 0\.375rem\);[^}]*backdrop-filter: none;/,
  );
  assert.match(
    navigationCss,
    /\.nav-dropdown-profile\s*\{[^}]*padding: 0 0 var\(--product-dropdown-inset, 0\.375rem\);[^}]*\}[\s\S]*?\.nav-dropdown-items\s*\{[^}]*margin: 0;[^}]*border-top: 0;[^}]*padding: 0;/,
  );
  assert.doesNotMatch(
    navigation,
    /className="my-0\.5 border-t border-black\/5 md:hidden"/,
  );
  assert.match(
    navigation,
    /querySelectorAll<HTMLElement>\([\s\S]*?role="menuitem"[\s\S]*?\.filter\(\(item\) => item\.getClientRects\(\)\.length > 0\)/,
  );
  assert.match(
    navigation,
    /focusMenuOnOpenRef\.current = nextOpen && event\.detail === 0/,
  );
  assert.match(
    navigation,
    /if \(!nextOpen\)\s*\{[\s\S]*?closeMenu\(event\.detail === 0\);[\s\S]*?return;/,
  );
  assert.match(
    navigation,
    /if \(!open \|\| !focusMenuOnOpenRef\.current\) return;[\s\S]*?focusMenuItem\("first"\)/,
  );
  assert.match(
    navigation,
    /const closeMenu = useCallback\([\s\S]*?setOpen\(false\)[\s\S]*?triggerRef\.current\?\.blur\(\)/,
  );
  assert.match(
    navigationCss,
    /\.nav-dropdown-item:focus-visible\s*\{[^}]*outline: none;[^}]*box-shadow: 0 0 0 2px rgba\(20, 20, 20, 0\.18\);/,
  );
  assert.match(mobileMenuItemFocusStyles, /outline: 2px solid #141414;/);
  assert.match(mobileMenuItemFocusStyles, /outline-offset: -2px;/);
  assert.match(mobileMenuItemFocusStyles, /box-shadow: none;/);
  assert.match(
    globalStyles,
    /@media \(forced-colors: active\)\s*\{[\s\S]*?\.product-dropdown-surface\s*\{[^}]*border: 1px solid CanvasText;[^}]*background: Canvas;[^}]*box-shadow: none;[^}]*\}[\s\S]*?\.nav-dropdown-item:focus-visible,[\s\S]*?outline: 2px solid Highlight;[^}]*outline-offset: -2px;[^}]*box-shadow: none;/,
  );
});
