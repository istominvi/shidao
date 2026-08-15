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

test("unoptimized preset images render their static WebP directly", () => {
  const markup = renderToStaticMarkup(
    createElement(Image, {
      src: "/avatars/presets/sd-avatar-v1-01.webp",
      alt: "",
      width: 96,
      height: 96,
      unoptimized: true,
    }),
  );

  assert.match(markup, /src="\/avatars\/presets\/sd-avatar-v1-01\.webp"/);
  assert.doesNotMatch(markup, /\/_next\/image/);
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
    /<Image[\s\S]*?src=\{preset\.src\}[\s\S]*?unoptimized[\s\S]*?sizes=/,
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

test("only protected mobile navigation uses a menu; every avatar links to Profile", () => {
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
    /aria-label="Открыть меню аккаунта"[\s\S]*?className="nav-user-trigger nav-account-menu-trigger inline-flex cursor-pointer items-center justify-center md:hidden"[\s\S]*?<Menu className="nav-main-menu-icon" aria-hidden="true" \/>/,
  );
  assert.match(
    navigation,
    /<NavigationDropdownPanel[\s\S]*?aria-label="Меню аккаунта"[\s\S]*?className="[^"]*md:hidden"/,
  );
  assert.match(
    navigation,
    /<PageTransitionLink\s+href=\{profileTabHref\("profile"\)\}[\s\S]*?aria-label="Открыть профиль"[\s\S]*?nav-profile-link[\s\S]*?isProtectedTopNav \? "hidden md:inline-flex" : "inline-flex"[\s\S]*?<AvatarImage/,
  );
  assert.doesNotMatch(
    navigation,
    /PROFILE_NAV_ITEMS|PROFILE_MENU_ICONS|handleSignOut|signOutViaServer|LogOut|portalMenu|createPortal/,
  );
  assert.match(navigation, /<div className="nav-dropdown-profile">/);
  assert.doesNotMatch(
    navigation.match(
      /<div className="nav-dropdown-profile">[\s\S]*?<\/div>\s*<\/div>/,
    )?.[0] ?? "",
    /AvatarImage|nav-user-trigger-avatar/,
  );
  assert.match(avatarImage, /rounded-xl/);
  assert.match(avatarImage, /style=\{\{ width: size, height: size \}\}/);
  assert.match(avatarImage, /width=\{size\}/);
  assert.match(avatarImage, /height=\{size\}/);
  assert.match(avatarImage, /height=\{size\}[\s\S]*?unoptimized/);
  assert.match(avatarImage, /className="h-full w-full object-cover"/);
  assert.match(avatarImage, /onError=\{\(\) => setFailedSrc\(src\)\}/);
  assert.match(
    navigationCss,
    /--header-pill-height: 2\.5rem[\s\S]*?\.nav-user-trigger-avatar\s*\{[\s\S]*?border-radius: var\(--product-element-radius/,
  );
  assert.match(
    navigationCss,
    /\.nav-user-trigger > \.nav-main-menu-icon,[\s\S]*?width: 1\.25rem;[\s\S]*?height: 1\.25rem;/,
  );
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
    /\.product-dropdown-surface\s*\{[^}]*border: 0;[^}]*--product-element-radius, 0\.75rem[^}]*padding: var\(--product-dropdown-inset, 0\.375rem\);[^}]*backdrop-filter: none;/,
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
    navigationCss,
    /\.nav-dropdown-item:focus-visible\s*\{[^}]*outline: none;[^}]*box-shadow: 0 0 0 2px rgba\(20, 20, 20, 0\.18\);/,
  );
  assert.match(
    globalStyles,
    /@media \(forced-colors: active\)\s*\{[\s\S]*?\.product-dropdown-surface\s*\{[^}]*border: 1px solid CanvasText;[^}]*background: Canvas;[^}]*box-shadow: none;[^}]*\}[\s\S]*?\.nav-dropdown-item:focus-visible,[\s\S]*?outline: 2px solid Highlight;[^}]*outline-offset: -2px;[^}]*box-shadow: none;/,
  );
});
