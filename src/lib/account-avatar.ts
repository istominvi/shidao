export const ACCOUNT_AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const AVATAR_PRESET_KEYS = [
  "sd-avatar-v1-01",
  "sd-avatar-v1-02",
  "sd-avatar-v1-03",
  "sd-avatar-v1-04",
  "sd-avatar-v1-05",
  "sd-avatar-v1-06",
  "sd-avatar-v1-07",
  "sd-avatar-v1-08",
  "sd-avatar-v1-09",
  "sd-avatar-v1-10",
  "sd-avatar-v1-11",
  "sd-avatar-v1-12",
  "sd-avatar-v1-13",
  "sd-avatar-v1-14",
  "sd-avatar-v1-15",
  "sd-avatar-v1-16",
  "sd-avatar-v1-17",
  "sd-avatar-v1-18",
  "sd-avatar-v1-19",
  "sd-avatar-v1-20",
] as const;

export type AvatarPresetKey = (typeof AVATAR_PRESET_KEYS)[number];

export type AccountAvatarView = {
  kind: "preset" | "custom";
  presetKey: AvatarPresetKey | null;
  revision: number;
  deliveryKey?: string;
};

export type AccountAvatarPreset = {
  key: AvatarPresetKey;
  label: string;
  dominantColor: "blue" | "green" | "purple" | "pink";
  src: string;
};

const PRESET_LABELS = [
  "Лиса",
  "Сова",
  "Кот",
  "Собака",
  "Кролик",
  "Медведь",
  "Панда",
  "Красная панда",
  "Тигр",
  "Олень",
  "Капибара",
  "Пингвин",
  "Выдра",
  "Лягушка",
  "Черепаха",
  "Аксолотль",
  "Кит",
  "Осьминог",
  "Енот",
  "Дракон",
] as const;

const PRESET_COLORS = [
  "blue",
  "blue",
  "blue",
  "blue",
  "blue",
  "green",
  "green",
  "green",
  "green",
  "green",
  "purple",
  "purple",
  "purple",
  "purple",
  "purple",
  "pink",
  "pink",
  "pink",
  "pink",
  "pink",
] as const;

export const AVATAR_PRESETS = AVATAR_PRESET_KEYS;

export const ACCOUNT_AVATAR_PRESETS: readonly AccountAvatarPreset[] =
  AVATAR_PRESET_KEYS.map((key, index) => ({
    key,
    label: PRESET_LABELS[index] ?? `Аватар ${index + 1}`,
    dominantColor: PRESET_COLORS[index] ?? "blue",
    src: `/avatars/presets/${key}.webp`,
  }));

export const DEFAULT_AVATAR_PRESET_KEY: AvatarPresetKey = AVATAR_PRESET_KEYS[0];

const AVATAR_PRESET_KEY_SET = new Set<string>(AVATAR_PRESET_KEYS);

export function isAvatarPresetKey(value: unknown): value is AvatarPresetKey {
  return typeof value === "string" && AVATAR_PRESET_KEY_SET.has(value);
}

export function parseAvatarPresetKey(value: unknown): AvatarPresetKey | null {
  return isAvatarPresetKey(value) ? value : null;
}

export function avatarPresetSrc(key: AvatarPresetKey): string {
  return `/avatars/presets/${key}.webp`;
}

export function accountAvatarSrc(avatar: AccountAvatarView): string {
  if (avatar.kind === "custom") {
    const params = new URLSearchParams({
      revision: String(avatar.revision),
    });
    if (avatar.deliveryKey) params.set("cache", avatar.deliveryKey);
    return `/api/settings/profile/avatar?${params.toString()}`;
  }

  return avatarPresetSrc(avatar.presetKey ?? DEFAULT_AVATAR_PRESET_KEY);
}
