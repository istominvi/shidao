import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("public image delivery is responsive, bounded, and locally allowlisted", () => {
  const config = source("next.config.ts");
  const storeGallery = source(
    "src/components/store/store-product-carousel.tsx",
  );
  const avatarImage = source("src/components/account/avatar-image.tsx");
  const avatarSettings = source(
    "src/components/account/avatar-settings-form.tsx",
  );
  const landing = source("src/components/landing-page.tsx");
  const middleware = source("src/middleware.ts");

  assert.match(config, /formats: \["image\/webp"\]/);
  assert.match(config, /qualities: \[75, 85\]/);
  assert.match(config, /minimumCacheTTL: 604_800/);
  assert.match(config, /maximumDiskCacheSize: 268_435_456/);
  assert.match(config, /pathname: "\/store\/products\/\*\*"/);
  assert.match(config, /pathname: "\/avatars\/presets\/\*\*"/);
  assert.doesNotMatch(config, /pathname: "\/api\/settings\/profile\/avatar"/);
  assert.doesNotMatch(config, /remotePatterns|supabase/i);
  assert.match(
    middleware,
    /avatars\/presets\/\|landing\/\|model\/\|store\/products\//,
  );
  assert.doesNotMatch(middleware, /\(\?![^\n]*api\/settings\/profile\/avatar/);

  assert.match(storeGallery, /quality=\{detail \? 85 : 75\}/);
  assert.match(storeGallery, /sizes=\{/);
  assert.doesNotMatch(storeGallery, /unoptimized/);
  assert.doesNotMatch(avatarImage, /unoptimized/);
  assert.match(avatarImage, /privateAvatarLoader/);
  assert.match(avatarImage, /avatar\.kind === "custom"/);
  assert.match(
    avatarSettings,
    /src=\{preset\.src\}[\s\S]*?quality=\{75\}[\s\S]*?sizes=/,
  );
  assert.match(
    landing,
    /src="\/landing\/screen_8\.png"[\s\S]*?sizes="\(max-width: 767px\)/,
  );
});

test("private and generated image sources stay outside the shared public cache", () => {
  const courseRenderers = source(
    "src/components/course-builder/component-renderers.tsx",
  );
  const avatarSettings = source(
    "src/components/account/avatar-settings-form.tsx",
  );
  const shareCode = source(
    "src/components/learner-identity/share-code-card.tsx",
  );
  const communicationPresenters = source(
    "src/components/communication/communication-presenters.tsx",
  );

  assert.match(
    courseRenderers,
    /function SignedImage[\s\S]*?<Image[\s\S]*?unoptimized/,
  );
  assert.match(avatarSettings, /src=\{customPreviewUrl\}[\s\S]*?unoptimized/);
  assert.match(shareCode, /src=\{qrDataUrl\}[\s\S]*?unoptimized/);
  assert.doesNotMatch(communicationPresenters, /from "next\/image"|<Image\b/);
});
