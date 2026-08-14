import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { ACCOUNT_AVATAR_MAX_UPLOAD_BYTES } from "@/lib/account-avatar";
import {
  detectProfileAvatarMimeType,
  processProfileAvatarImage,
  ProfileAvatarInputError,
} from "../profile-avatar-image";

test("profile avatar magic detection accepts only JPEG, PNG and WebP", () => {
  assert.equal(
    detectProfileAvatarMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0x00])),
    "image/jpeg",
  );
  assert.equal(
    detectProfileAvatarMimeType(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ),
    "image/png",
  );
  assert.equal(
    detectProfileAvatarMimeType(
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
      ]),
    ),
    "image/webp",
  );
  assert.equal(
    detectProfileAvatarMimeType(
      new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"),
    ),
    null,
  );
});

test("profile avatar processing rotates, crops, strips metadata and emits bounded WebP", async () => {
  const input = await sharp({
    create: {
      width: 900,
      height: 500,
      channels: 4,
      background: { r: 112, g: 183, b: 255, alpha: 0.4 },
    },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();

  const output = await processProfileAvatarImage({
    bytes: input,
    declaredMimeType: "image/jpeg",
  });
  const metadata = await sharp(output.bytes).metadata();

  assert.equal(output.mimeType, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
  assert.equal(metadata.pages, undefined);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.orientation, undefined);
  assert.ok(output.bytes.byteLength < 1024 * 1024);
});

test("profile avatar processing rejects MIME spoofing and unsupported formats", async () => {
  const png = await sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: "#70b7ff",
    },
  })
    .png()
    .toBuffer();

  await assert.rejects(
    processProfileAvatarImage({
      bytes: png,
      declaredMimeType: "image/jpeg",
    }),
    /не совпадает/,
  );
  await assert.rejects(
    processProfileAvatarImage({
      bytes: new TextEncoder().encode("<svg><script>alert(1)</script></svg>"),
      declaredMimeType: "image/png",
    }),
    /не совпадает/,
  );
  await assert.rejects(
    processProfileAvatarImage({
      bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
      declaredMimeType: "image/gif",
    }),
    (error) => error instanceof ProfileAvatarInputError && error.status === 415,
  );
});

test("profile avatar processing rejects oversized files and dimensions", async () => {
  await assert.rejects(
    processProfileAvatarImage({
      bytes: new Uint8Array(ACCOUNT_AVATAR_MAX_UPLOAD_BYTES + 1),
      declaredMimeType: "image/png",
    }),
    (error) => error instanceof ProfileAvatarInputError && error.status === 413,
  );

  const tooWide = await sharp({
    create: {
      width: 4097,
      height: 1,
      channels: 3,
      background: "#c9ff4f",
    },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    processProfileAvatarImage({
      bytes: tooWide,
      declaredMimeType: "image/png",
    }),
    /неподдерживаемые параметры/,
  );
});
