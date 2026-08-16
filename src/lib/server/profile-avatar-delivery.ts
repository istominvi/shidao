import crypto from "node:crypto";

const DELIVERY_KEY_SCOPE = "shidao:profile-avatar-delivery:v1";
const DELIVERY_KEY_LENGTH = 24;
const MIN_SECRET_LENGTH = 32;

export const PROFILE_AVATAR_DELIVERY_KEY_PATTERN = /^[A-Za-z0-9_-]{24}$/;

function appSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "Configuration error: APP_SESSION_SECRET is required for private image delivery.",
    );
  }
  return secret;
}

export function createProfileAvatarDeliveryKey(input: {
  authUserId: string;
  revision: number;
}) {
  return crypto
    .createHmac("sha256", appSessionSecret())
    .update(DELIVERY_KEY_SCOPE)
    .update("\0")
    .update(input.authUserId)
    .update("\0")
    .update(String(input.revision))
    .digest("base64url")
    .slice(0, DELIVERY_KEY_LENGTH);
}
