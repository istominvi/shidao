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

test("header uses a square avatar image and dropdown keeps identity text only", () => {
  const navigation = source("src/components/session-nav-actions.tsx");
  const avatarImage = source("src/components/account/avatar-image.tsx");
  const navigationCss = source("src/app/styles/navigation.css");

  assert.match(
    navigation,
    /<AvatarImage[\s\S]*?avatar=\{state\.avatar\}[\s\S]*?size=\{40\}/,
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
});
