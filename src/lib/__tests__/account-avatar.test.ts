import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  ACCOUNT_AVATAR_PRESETS,
  AVATAR_PRESET_KEYS,
  DEFAULT_AVATAR_PRESET_KEY,
  accountAvatarSrc,
  avatarPresetSrc,
  isAvatarPresetKey,
  parseAvatarPresetKey,
} from "../account-avatar";

test("account avatar manifest exposes twenty stable, unique presets", () => {
  const presetDirectory = join(process.cwd(), "public", "avatars", "presets");
  const presetFiles = readdirSync(presetDirectory)
    .filter((fileName) => fileName.endsWith(".webp"))
    .sort();

  assert.equal(AVATAR_PRESET_KEYS.length, 20);
  assert.equal(new Set(AVATAR_PRESET_KEYS).size, 20);
  assert.equal(ACCOUNT_AVATAR_PRESETS.length, 20);
  assert.equal(DEFAULT_AVATAR_PRESET_KEY, "sd-avatar-v1-01");
  assert.deepEqual(
    presetFiles,
    AVATAR_PRESET_KEYS.map((key) => `${key}.webp`),
    "preset directory and typed manifest must contain the same twenty files",
  );

  for (const [index, preset] of ACCOUNT_AVATAR_PRESETS.entries()) {
    const suffix = String(index + 1).padStart(2, "0");
    assert.equal(preset.key, `sd-avatar-v1-${suffix}`);
    assert.equal(preset.src, `/avatars/presets/${preset.key}.webp`);
    assert.ok(preset.label.length > 0);
    assert.ok(
      existsSync(join(process.cwd(), "public", preset.src.slice(1))),
      `missing ${preset.src}`,
    );
  }
});

test("avatar preset parser and source helpers fail closed", () => {
  assert.equal(isAvatarPresetKey("sd-avatar-v1-20"), true);
  assert.equal(isAvatarPresetKey("sd-avatar-v1-21"), false);
  assert.equal(parseAvatarPresetKey("sd-avatar-v1-02"), "sd-avatar-v1-02");
  assert.equal(parseAvatarPresetKey("../../secret"), null);
  assert.equal(
    avatarPresetSrc("sd-avatar-v1-03"),
    "/avatars/presets/sd-avatar-v1-03.webp",
  );
  assert.equal(
    accountAvatarSrc({
      kind: "preset",
      presetKey: "sd-avatar-v1-04",
      revision: 7,
    }),
    "/avatars/presets/sd-avatar-v1-04.webp",
  );
  assert.equal(
    accountAvatarSrc({ kind: "custom", presetKey: null, revision: 8 }),
    "/api/settings/profile/avatar?revision=8",
  );
  assert.equal(
    accountAvatarSrc({
      kind: "custom",
      presetKey: null,
      revision: 8,
      deliveryKey: "abcdefghijklmnopqrstuvwx",
    }),
    "/api/settings/profile/avatar?revision=8&cache=abcdefghijklmnopqrstuvwx",
  );
});
