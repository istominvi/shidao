import sharp from "sharp";
import { ACCOUNT_AVATAR_MAX_UPLOAD_BYTES } from "@/lib/account-avatar";
import {
  PROFILE_AVATAR_OUTPUT_BYTES_LIMIT,
  PROFILE_AVATAR_OUTPUT_MIME_TYPE,
} from "@/lib/server/profile-avatar-storage";

export const PROFILE_AVATAR_DIMENSION = 512;
export const PROFILE_AVATAR_MAX_SOURCE_DIMENSION = 4096;
export const PROFILE_AVATAR_DELIVERY_WIDTHS = [
  32, 40, 48, 64, 72, 80, 96, 112, 128, 144, 160, 192, 256, 384, 480, 512,
] as const;

const PROFILE_AVATAR_DELIVERY_WIDTH_SET = new Set<number>(
  PROFILE_AVATAR_DELIVERY_WIDTHS,
);

export type ProfileAvatarInputMimeType =
  "image/jpeg" | "image/png" | "image/webp";

export class ProfileAvatarInputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 = 400,
  ) {
    super(message);
    this.name = "ProfileAvatarInputError";
  }
}

export function parseProfileAvatarDeliveryWidth(value: string | null) {
  if (value === null) return PROFILE_AVATAR_DIMENSION;
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  const width = Number(value);
  return PROFILE_AVATAR_DELIVERY_WIDTH_SET.has(width) ? width : null;
}

export async function renderProfileAvatarDeliveryVariant(
  bytes: Uint8Array,
  width: number,
) {
  if (!PROFILE_AVATAR_DELIVERY_WIDTH_SET.has(width)) {
    throw new Error("Profile avatar delivery width is invalid.");
  }
  if (width === PROFILE_AVATAR_DIMENSION) return new Uint8Array(bytes);

  const output = await sharp(new Uint8Array(bytes), {
    failOn: "warning",
    limitInputPixels: PROFILE_AVATAR_DIMENSION * PROFILE_AVATAR_DIMENSION,
    sequentialRead: true,
  })
    .resize(width, width, { fit: "cover", position: "centre" })
    .toColourspace("srgb")
    .webp({ quality: 80, effort: 3, smartSubsample: true })
    .toBuffer();

  if (
    output.byteLength < 1 ||
    output.byteLength > PROFILE_AVATAR_OUTPUT_BYTES_LIMIT
  ) {
    throw new Error("Profile avatar delivery output is invalid.");
  }
  return new Uint8Array(output);
}

const PROFILE_AVATAR_INPUT_MIME_TYPES = new Set<ProfileAvatarInputMimeType>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function isProfileAvatarInputMimeType(
  value: unknown,
): value is ProfileAvatarInputMimeType {
  return (
    typeof value === "string" &&
    PROFILE_AVATAR_INPUT_MIME_TYPES.has(value as ProfileAvatarInputMimeType)
  );
}

export function detectProfileAvatarMimeType(
  bytes: Uint8Array,
): ProfileAvatarInputMimeType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function processProfileAvatarImage(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
}) {
  if (
    input.bytes.byteLength < 1 ||
    input.bytes.byteLength > ACCOUNT_AVATAR_MAX_UPLOAD_BYTES
  ) {
    throw new ProfileAvatarInputError(
      "Размер изображения должен быть не больше 5 МБ.",
      413,
    );
  }
  if (!isProfileAvatarInputMimeType(input.declaredMimeType)) {
    throw new ProfileAvatarInputError(
      "Поддерживаются только JPEG, PNG и WebP.",
      415,
    );
  }
  const detectedMimeType = detectProfileAvatarMimeType(input.bytes);
  if (detectedMimeType !== input.declaredMimeType) {
    throw new ProfileAvatarInputError(
      "Формат изображения не совпадает с содержимым файла.",
    );
  }

  const sourceBytes = new Uint8Array(input.bytes);
  const sharpOptions = {
    failOn: "warning" as const,
    limitInputPixels:
      PROFILE_AVATAR_MAX_SOURCE_DIMENSION * PROFILE_AVATAR_MAX_SOURCE_DIMENSION,
    sequentialRead: true,
  };

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(sourceBytes, sharpOptions).metadata();
  } catch {
    throw new ProfileAvatarInputError("Не удалось прочитать изображение.");
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > PROFILE_AVATAR_MAX_SOURCE_DIMENSION ||
    metadata.height > PROFILE_AVATAR_MAX_SOURCE_DIMENSION ||
    (metadata.pages ?? 1) !== 1 ||
    !["jpeg", "png", "webp"].includes(metadata.format ?? "")
  ) {
    throw new ProfileAvatarInputError(
      "Изображение имеет неподдерживаемые параметры.",
    );
  }

  let output: Buffer;
  try {
    output = await sharp(sourceBytes, sharpOptions)
      .rotate()
      .resize(PROFILE_AVATAR_DIMENSION, PROFILE_AVATAR_DIMENSION, {
        fit: "cover",
        position: "centre",
      })
      .flatten({ background: { r: 245, g: 241, b: 232 } })
      .toColourspace("srgb")
      .webp({ quality: 82, effort: 4, smartSubsample: true })
      .toBuffer();
  } catch {
    throw new ProfileAvatarInputError("Не удалось обработать изображение.");
  }

  if (
    output.byteLength < 1 ||
    output.byteLength > PROFILE_AVATAR_OUTPUT_BYTES_LIMIT
  ) {
    throw new ProfileAvatarInputError(
      "Обработанное изображение превышает допустимый размер.",
      413,
    );
  }

  const outputMetadata = await sharp(output, {
    limitInputPixels:
      PROFILE_AVATAR_MAX_SOURCE_DIMENSION * PROFILE_AVATAR_MAX_SOURCE_DIMENSION,
  }).metadata();
  if (
    outputMetadata.format !== "webp" ||
    outputMetadata.width !== PROFILE_AVATAR_DIMENSION ||
    outputMetadata.height !== PROFILE_AVATAR_DIMENSION ||
    (outputMetadata.pages ?? 1) !== 1
  ) {
    throw new ProfileAvatarInputError(
      "Обработанное изображение не прошло проверку.",
    );
  }

  return {
    bytes: new Uint8Array(output),
    mimeType: PROFILE_AVATAR_OUTPUT_MIME_TYPE,
  } as const;
}
